import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/index.js'
import { billingContracts, billingSummaries } from '../../db/schema/app.js'
import {
  apiRequest,
  createTestTenant,
  TEST_MONTH,
  TEST_YEAR,
  type TestTenant,
} from '../../test/helpers.js'

describe('精算APIの閲覧権限', () => {
  let tenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
  })

  const endpoints = (t: TestTenant) => [
    '/billing/contracts',
    `/billing/contracts/${t.contractId}`,
    `/billing/summaries?year=${TEST_YEAR}&month=${TEST_MONTH}`,
  ]

  it.each(['manager', 'employee'] as const)('%s が呼ぶと403を返す', async (role) => {
    for (const path of endpoints(tenant)) {
      const res = await apiRequest(path, { token: tenant.users[role].token })
      expect(res.status, path).toBe(403)
    }
  })

  it('admin は閲覧できる', async () => {
    for (const path of endpoints(tenant)) {
      const res = await apiRequest(path, { token: tenant.users.admin.token })
      expect(res.status, path).toBe(200)
    }
  })
})

describe('POST /billing/summaries/:id/confirm', () => {
  let tenant: TestTenant
  let otherTenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
    otherTenant = await createTestTenant()
  })

  async function findSummaryStatus(id: string): Promise<string | undefined> {
    const [row] = await db
      .select({ status: billingSummaries.status })
      .from(billingSummaries)
      .where(eq(billingSummaries.id, id))
    return row?.status
  }

  it('他テナントのサマリーIDを指定すると404を返し、そのサマリーは確定されない', async () => {
    const res = await apiRequest(`/billing/summaries/${otherTenant.summaryId}/confirm`, {
      token: tenant.users.admin.token,
      method: 'POST',
    })

    expect(res.status).toBe(404)
    expect(await findSummaryStatus(otherTenant.summaryId)).toBe('draft')
  })

  it('自テナントのサマリーは確定できる', async () => {
    const res = await apiRequest(`/billing/summaries/${tenant.summaryId}/confirm`, {
      token: tenant.users.admin.token,
      method: 'POST',
    })

    expect(res.status).toBe(200)
    expect(await findSummaryStatus(tenant.summaryId)).toBe('confirmed')
  })
})

describe('精算契約のworkTypeId', () => {
  let tenant: TestTenant
  let otherTenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
    otherTenant = await createTestTenant()
  })

  it('POST /billing/contracts に他テナントのworkTypeIdを指定すると404を返す', async () => {
    const res = await apiRequest('/billing/contracts', {
      token: tenant.users.admin.token,
      method: 'POST',
      body: {
        workTypeId: otherTenant.workTypeId,
        clientName: '不正な契約',
        billingType: 'hourly',
        contractStart: `${TEST_YEAR}-01-01`,
      },
    })

    expect(res.status).toBe(404)
  })

  it('PATCH /billing/contracts/:id に他テナントのworkTypeIdを指定すると404を返し、契約は変わらない', async () => {
    const res = await apiRequest(`/billing/contracts/${tenant.contractId}`, {
      token: tenant.users.admin.token,
      method: 'PATCH',
      body: { workTypeId: otherTenant.workTypeId },
    })

    expect(res.status).toBe(404)
    const [contract] = await db
      .select({ workTypeId: billingContracts.workTypeId })
      .from(billingContracts)
      .where(eq(billingContracts.id, tenant.contractId))
    expect(contract.workTypeId).toBe(tenant.workTypeId)
  })
})
