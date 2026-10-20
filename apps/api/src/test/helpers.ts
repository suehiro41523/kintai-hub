import { randomUUID } from 'node:crypto'
import { app } from '../app.js'
import { db, initDb } from '../db/index.js'
import { billingContracts, billingSummaries, workTypes } from '../db/schema/app.js'
import { tenants, users } from '../db/schema/core.js'
import type { Role } from '../types.js'
import { TEST_DATABASE_URL } from './database-url.js'

initDb(TEST_DATABASE_URL)

export type TestUser = {
  id: string
  // Bearerトークンとしてそのまま使う値（setup.ts のSupabaseモック参照）
  token: string
}

export type TestTenant = {
  tenantId: string
  users: Record<Role, TestUser>
  workTypeId: string
  contractId: string
  summaryId: string
}

export const TEST_YEAR = 2026
export const TEST_MONTH = 9

async function createUser(tenantId: string, role: Role): Promise<TestUser> {
  const id = randomUUID()
  const authUserId = randomUUID()
  await db.insert(users).values({
    id,
    tenantId,
    authUserId,
    name: `テスト${role}`,
    email: `${role}-${id}@example.com`,
    role,
    employmentType: 'full_time',
  })
  return { id, token: authUserId }
}

// テストごとに独立したテナントを作る。admin・manager・employeeの3ユーザーと、
// 精算契約1件・その下書きサマリー1件（TEST_YEAR年TEST_MONTH月）を持つ
export async function createTestTenant(): Promise<TestTenant> {
  const tenantId = randomUUID()
  await db
    .insert(tenants)
    .values({ id: tenantId, name: 'テスト株式会社', plan: 'free', status: 'active' })

  const [admin, manager, employee] = await Promise.all([
    createUser(tenantId, 'admin'),
    createUser(tenantId, 'manager'),
    createUser(tenantId, 'employee'),
  ])

  const workTypeId = randomUUID()
  await db.insert(workTypes).values({
    id: workTypeId,
    tenantId,
    name: '客先常駐',
    color: '#3b82f6',
    billingType: 'hourly',
  })

  const contractId = randomUUID()
  await db.insert(billingContracts).values({
    id: contractId,
    tenantId,
    workTypeId,
    clientName: 'テスト取引先',
    billingType: 'hourly',
    contractStart: `${TEST_YEAR}-01-01`,
  })

  const summaryId = randomUUID()
  await db.insert(billingSummaries).values({
    id: summaryId,
    contractId,
    year: TEST_YEAR,
    month: TEST_MONTH,
    actualHours: '160.00',
    billingHours: '160.00',
    billingAmount: '800000.00',
    status: 'draft',
  })

  return { tenantId, users: { admin, manager, employee }, workTypeId, contractId, summaryId }
}

export function apiRequest(
  path: string,
  options: { token: string; method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<Response> {
  return Promise.resolve(
    app.request(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${options.token}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    }),
  )
}
