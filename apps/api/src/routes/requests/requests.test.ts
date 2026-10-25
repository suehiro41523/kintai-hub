import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/index.js'
import { requests } from '../../db/schema/app.js'
import { findAuditLogs } from '../../test/audit-logs.js'
import { apiRequest, createTestTenant, type TestTenant, type TestUser } from '../../test/helpers.js'

describe('申請の承認・却下', () => {
  let tenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
  })

  async function createRequest(applicant: TestUser): Promise<string> {
    const res = await apiRequest('/requests', {
      token: applicant.token,
      method: 'POST',
      body: { requestType: 'leave', startDate: '2026-11-02', reason: '私用' },
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { request: { id: string } }
    return body.request.id
  }

  async function findStatus(id: string): Promise<string> {
    const [row] = await db
      .select({ status: requests.status })
      .from(requests)
      .where(eq(requests.id, id))
    return row.status
  }

  it.each(['approve', 'reject'])(
    'managerが自分の申請を%sしようとすると403を返し、申請は承認待ちのまま',
    async (action) => {
      const requestId = await createRequest(tenant.users.manager)

      const res = await apiRequest(`/requests/${requestId}/${action}`, {
        token: tenant.users.manager.token,
        method: 'POST',
        body: {},
      })

      expect(res.status).toBe(403)
      expect(await findStatus(requestId)).toBe('pending')
      expect(await findAuditLogs(tenant.tenantId, requestId)).toEqual([])
    },
  )

  it('adminは自分の申請を承認できる', async () => {
    const requestId = await createRequest(tenant.users.admin)

    const res = await apiRequest(`/requests/${requestId}/approve`, {
      token: tenant.users.admin.token,
      method: 'POST',
      body: {},
    })

    expect(res.status).toBe(200)
    expect(await findStatus(requestId)).toBe('approved')
  })

  it('managerが他人の申請を承認すると、監査ログに操作者と変更前後の状態が記録される', async () => {
    const requestId = await createRequest(tenant.users.employee)

    const res = await apiRequest(`/requests/${requestId}/approve`, {
      token: tenant.users.manager.token,
      method: 'POST',
      body: { comment: '承認します' },
    })

    expect(res.status).toBe(200)
    expect(await findAuditLogs(tenant.tenantId, requestId)).toEqual([
      {
        userId: tenant.users.manager.id,
        action: 'approve',
        resourceType: 'request',
        beforeValue: { status: 'pending' },
        afterValue: { status: 'approved', comment: '承認します' },
        ipAddress: null,
      },
    ])
  })

  it('managerが他人の申請を却下すると、監査ログに記録される', async () => {
    const requestId = await createRequest(tenant.users.employee)

    const res = await apiRequest(`/requests/${requestId}/reject`, {
      token: tenant.users.manager.token,
      method: 'POST',
      body: { comment: '日程を再調整してください' },
    })

    expect(res.status).toBe(200)
    const logs = await findAuditLogs(tenant.tenantId, requestId)
    expect(logs.map((l) => [l.action, l.afterValue])).toEqual([
      ['reject', { status: 'rejected', comment: '日程を再調整してください' }],
    ])
  })
})
