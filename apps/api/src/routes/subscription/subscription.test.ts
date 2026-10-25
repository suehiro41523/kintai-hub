import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/index.js'
import { tenants, users } from '../../db/schema/core.js'
import { FREE_PLAN_MAX_USERS } from '../../lib/plan-limits.js'
import { supabaseAdmin } from '../../lib/supabase.js'
import { apiRequest, createTestTenant, type TestTenant } from '../../test/helpers.js'

// setup.ts で supabaseAdmin は空オブジェクトにモックされている。招待メールの送信だけを差し替えて、呼ばれたかを確認する
const inviteUserByEmail = vi.fn(async () => ({ data: { user: { id: randomUUID() } }, error: null }))
Object.assign(supabaseAdmin, { auth: { admin: { inviteUserByEmail, deleteUser: vi.fn() } } })

// createTestTenant() は在籍ユーザー3人(admin・manager・employee)で作られる
const INITIAL_USERS = 3

async function addActiveUsers(tenantId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const id = randomUUID()
    await db.insert(users).values({
      id,
      tenantId,
      authUserId: randomUUID(),
      name: `追加ユーザー${i}`,
      email: `extra-${id}@example.com`,
      role: 'employee',
      employmentType: 'full_time',
    })
  }
}

async function setPaidPlan(tenantId: string, billedSeats: number): Promise<void> {
  await db
    .update(tenants)
    .set({ plan: 'standard', billedSeats, stripeSubscriptionId: 'sub_test' })
    .where(eq(tenants.id, tenantId))
}

describe('POST /users の人数上限', () => {
  let tenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
    inviteUserByEmail.mockClear()
  })

  function invite() {
    return apiRequest('/users', {
      token: tenant.users.admin.token,
      method: 'POST',
      body: {
        name: '新入社員',
        email: `new-${randomUUID()}@example.com`,
        role: 'employee',
        employmentType: 'full_time',
      },
    })
  }

  it('無料プランで上限に達していると409を返し、招待メールを送らない', async () => {
    await addActiveUsers(tenant.tenantId, FREE_PLAN_MAX_USERS - INITIAL_USERS)

    const res = await invite()

    expect(res.status).toBe(409)
    expect(((await res.json()) as { code: string }).code).toBe('USER_LIMIT_REACHED')
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('無料プランで上限未満なら登録できる', async () => {
    await addActiveUsers(tenant.tenantId, FREE_PLAN_MAX_USERS - INITIAL_USERS - 1)

    const res = await invite()

    expect(res.status).toBe(201)
    expect(inviteUserByEmail).toHaveBeenCalledOnce()
  })

  it('有料プランで在籍人数が契約人数に達していると409を返す', async () => {
    await setPaidPlan(tenant.tenantId, INITIAL_USERS)

    const res = await invite()

    expect(res.status).toBe(409)
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('無効化済みのユーザーは在籍人数に数えない', async () => {
    await setPaidPlan(tenant.tenantId, INITIAL_USERS)
    await db.update(users).set({ isActive: false }).where(eq(users.id, tenant.users.employee.id))

    const res = await invite()

    expect(res.status).toBe(201)
  })
})

describe('契約人数の変更', () => {
  let tenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
    await setPaidPlan(tenant.tenantId, 10)
  })

  it('PATCH /subscription/seats に在籍人数未満を指定すると400を返し、契約人数は変わらない', async () => {
    const res = await apiRequest('/subscription/seats', {
      token: tenant.users.admin.token,
      method: 'PATCH',
      body: { seats: INITIAL_USERS - 1 },
    })

    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe('SEATS_BELOW_ACTIVE_USERS')
    const [row] = await db
      .select({ billedSeats: tenants.billedSeats })
      .from(tenants)
      .where(eq(tenants.id, tenant.tenantId))
    expect(row.billedSeats).toBe(10)
  })

  it('POST /subscription/checkout に在籍人数未満を指定すると400を返す', async () => {
    const res = await apiRequest('/subscription/checkout', {
      token: tenant.users.admin.token,
      method: 'POST',
      body: { plan: 'pro', seats: INITIAL_USERS - 1 },
    })

    expect(res.status).toBe(400)
  })
})
