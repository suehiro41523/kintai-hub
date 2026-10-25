import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/index.js'
import { shiftPatterns } from '../../db/schema/app.js'
import { apiRequest, createTestTenant, type TestTenant } from '../../test/helpers.js'

type BulkResponse = {
  created: { userId: string }[]
  updated: unknown[]
  errors: { index: number; message: string }[]
}

async function createShiftPattern(tenantId: string): Promise<string> {
  const id = randomUUID()
  await db.insert(shiftPatterns).values({
    id,
    tenantId,
    name: '日勤',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
  })
  return id
}

describe('POST /shifts/bulk の参照ID', () => {
  let tenant: TestTenant
  let otherTenant: TestTenant
  let shiftPatternId: string
  let otherShiftPatternId: string

  beforeEach(async () => {
    tenant = await createTestTenant()
    otherTenant = await createTestTenant()
    shiftPatternId = await createShiftPattern(tenant.tenantId)
    otherShiftPatternId = await createShiftPattern(otherTenant.tenantId)
  })

  it('他テナントの userId・workTypeId・shiftPatternId を含む行は登録されず、errors に含まれる', async () => {
    const base = {
      userId: tenant.users.employee.id,
      startTime: '09:00',
      endTime: '18:00',
      workTypeId: tenant.workTypeId,
      shiftPatternId,
    }

    const res = await apiRequest('/shifts/bulk', {
      token: tenant.users.manager.token,
      method: 'POST',
      body: {
        shifts: [
          { ...base, shiftDate: '2026-11-02' },
          { ...base, shiftDate: '2026-11-03', userId: otherTenant.users.employee.id },
          { ...base, shiftDate: '2026-11-04', workTypeId: otherTenant.workTypeId },
          { ...base, shiftDate: '2026-11-05', shiftPatternId: otherShiftPatternId },
        ],
      },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as BulkResponse
    expect(body.created).toHaveLength(1)
    expect(body.created[0].userId).toBe(tenant.users.employee.id)
    expect(body.errors.map((e) => e.index)).toEqual([1, 2, 3])
  })
})
