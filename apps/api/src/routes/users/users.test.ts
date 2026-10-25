import { beforeEach, describe, expect, it } from 'vitest'
import { findAuditLogs } from '../../test/audit-logs.js'
import { apiRequest, createTestTenant, type TestTenant } from '../../test/helpers.js'

describe('従業員の更新・無効化の監査ログ', () => {
  let tenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
  })

  it('ロールを変更すると、指定した項目の変更前後が監査ログに記録される', async () => {
    const targetId = tenant.users.employee.id

    const res = await apiRequest(`/users/${targetId}`, {
      token: tenant.users.admin.token,
      method: 'PATCH',
      body: { role: 'manager' },
    })

    expect(res.status).toBe(200)
    expect(await findAuditLogs(tenant.tenantId, targetId)).toEqual([
      {
        userId: tenant.users.admin.id,
        action: 'update',
        resourceType: 'user',
        beforeValue: { role: 'employee' },
        afterValue: { role: 'manager' },
        ipAddress: null,
      },
    ])
  })

  it('無効化すると監査ログに記録される', async () => {
    const targetId = tenant.users.employee.id

    const res = await apiRequest(`/users/${targetId}`, {
      token: tenant.users.admin.token,
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const logs = await findAuditLogs(tenant.tenantId, targetId)
    expect(logs.map((l) => [l.action, l.beforeValue, l.afterValue])).toEqual([
      ['deactivate', { isActive: true }, { isActive: false }],
    ])
  })
})
