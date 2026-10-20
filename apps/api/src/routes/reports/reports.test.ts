import { beforeEach, describe, expect, it } from 'vitest'
import {
  apiRequest,
  createTestTenant,
  TEST_MONTH,
  TEST_YEAR,
  type TestTenant,
} from '../../test/helpers.js'

type MonthlyReportResponse = {
  report: {
    billingBreakdown?: { contractId: string; clientName: string }[]
  }
}

describe('GET /reports/monthly の精算内訳', () => {
  let tenant: TestTenant
  const path = `/reports/monthly?year=${TEST_YEAR}&month=${TEST_MONTH}`

  beforeEach(async () => {
    tenant = await createTestTenant()
  })

  it.each(['manager', 'employee'] as const)(
    '%s へのレスポンスには billingBreakdown を含めない',
    async (role) => {
      const res = await apiRequest(path, { token: tenant.users[role].token })

      expect(res.status).toBe(200)
      const body = (await res.json()) as MonthlyReportResponse
      expect(body.report).not.toHaveProperty('billingBreakdown')
    },
  )

  it('admin へのレスポンスには自テナントの精算内訳を含める', async () => {
    const res = await apiRequest(path, { token: tenant.users.admin.token })

    expect(res.status).toBe(200)
    const body = (await res.json()) as MonthlyReportResponse
    expect(body.report.billingBreakdown?.map((b) => b.contractId)).toEqual([tenant.contractId])
  })
})
