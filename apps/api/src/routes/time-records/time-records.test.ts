import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/index.js'
import { timeRecords, workTypes } from '../../db/schema/app.js'
import { apiRequest, createTestTenant, type TestTenant } from '../../test/helpers.js'

describe('打刻APIのworkTypeId', () => {
  let tenant: TestTenant
  let otherTenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
    otherTenant = await createTestTenant()
  })

  async function clockIn(): Promise<string> {
    const res = await apiRequest('/time-records/clock-in', {
      token: tenant.users.employee.token,
      method: 'POST',
      body: { workTypeId: tenant.workTypeId },
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { record: { id: string } }
    return body.record.id
  }

  async function findRecordWorkTypeId(id: string): Promise<string | undefined> {
    const [row] = await db
      .select({ workTypeId: timeRecords.workTypeId })
      .from(timeRecords)
      .where(eq(timeRecords.id, id))
    return row?.workTypeId
  }

  it('PATCH /time-records/:id に他テナントのworkTypeIdを指定すると404を返し、打刻は変わらない', async () => {
    const recordId = await clockIn()

    const res = await apiRequest(`/time-records/${recordId}`, {
      token: tenant.users.manager.token,
      method: 'PATCH',
      body: { workTypeId: otherTenant.workTypeId },
    })

    expect(res.status).toBe(404)
    expect(await findRecordWorkTypeId(recordId)).toBe(tenant.workTypeId)
  })

  it('PATCH /time-records/:id に無効化済みのワークタイプを指定すると404を返す', async () => {
    const recordId = await clockIn()
    const inactiveWorkTypeId = randomUUID()
    await db.insert(workTypes).values({
      id: inactiveWorkTypeId,
      tenantId: tenant.tenantId,
      name: '無効化済み',
      color: '#999999',
      billingType: 'hourly',
      isActive: false,
    })

    const res = await apiRequest(`/time-records/${recordId}`, {
      token: tenant.users.manager.token,
      method: 'PATCH',
      body: { workTypeId: inactiveWorkTypeId },
    })

    expect(res.status).toBe(404)
  })

  it.each(['break-start', 'break-end'])(
    'POST /time-records/%s に他テナントのworkTypeIdを指定すると404を返す',
    async (endpoint) => {
      const res = await apiRequest(`/time-records/${endpoint}`, {
        token: tenant.users.employee.token,
        method: 'POST',
        body: { workTypeId: otherTenant.workTypeId },
      })

      expect(res.status).toBe(404)
    },
  )
})
