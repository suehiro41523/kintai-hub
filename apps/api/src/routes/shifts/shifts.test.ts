import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/index.js'
import { shiftPatterns, shifts } from '../../db/schema/app.js'
import { apiRequest, createTestTenant, type TestTenant } from '../../test/helpers.js'

type BulkResponse = {
  created: { shiftDate: string }[]
  updated: { shiftDate: string }[]
}

type ErrorResponse = {
  code: string
  details?: { field: string; message: string }[]
}

type ShiftRow = {
  userId?: string
  shiftDate: string
  startTime?: string
  endTime?: string
  workTypeId?: string
  shiftPatternId?: string
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

describe('POST /shifts/bulk', () => {
  let tenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
  })

  function bulk(rows: ShiftRow[]) {
    return apiRequest('/shifts/bulk', {
      token: tenant.users.manager.token,
      method: 'POST',
      body: {
        shifts: rows.map((row) => ({
          userId: tenant.users.employee.id,
          startTime: '09:00',
          endTime: '18:00',
          workTypeId: tenant.workTypeId,
          ...row,
        })),
      },
    })
  }

  async function findShifts() {
    return db
      .select({ shiftDate: shifts.shiftDate, startTime: shifts.startTime })
      .from(shifts)
      .where(eq(shifts.tenantId, tenant.tenantId))
      .orderBy(asc(shifts.shiftDate))
  }

  it('新規の行は created、既存の行は updated に入り、DBに反映される', async () => {
    await bulk([{ shiftDate: '2026-11-02' }])

    const res = await bulk([
      { shiftDate: '2026-11-02', startTime: '10:00' },
      { shiftDate: '2026-11-03' },
    ])

    expect(res.status).toBe(200)
    const body = (await res.json()) as BulkResponse
    expect(body.updated.map((s) => s.shiftDate)).toEqual(['2026-11-02'])
    expect(body.created.map((s) => s.shiftDate)).toEqual(['2026-11-03'])
    expect(await findShifts()).toEqual([
      { shiftDate: '2026-11-02', startTime: '10:00:00' },
      { shiftDate: '2026-11-03', startTime: '09:00:00' },
    ])
  })

  it('他テナントの userId・workTypeId・shiftPatternId を1件でも含むと400を返し、どの行も登録しない', async () => {
    const otherTenant = await createTestTenant()
    const shiftPatternId = await createShiftPattern(tenant.tenantId)
    const otherShiftPatternId = await createShiftPattern(otherTenant.tenantId)

    const res = await bulk([
      { shiftDate: '2026-11-02', shiftPatternId },
      { shiftDate: '2026-11-03', userId: otherTenant.users.employee.id },
      { shiftDate: '2026-11-04', workTypeId: otherTenant.workTypeId },
      { shiftDate: '2026-11-05', shiftPatternId: otherShiftPatternId },
    ])

    expect(res.status).toBe(400)
    const body = (await res.json()) as ErrorResponse
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.details?.map((d) => d.field)).toEqual([
      'shifts.1.userId',
      'shifts.2.workTypeId',
      'shifts.3.shiftPatternId',
    ])
    expect(await findShifts()).toEqual([])
  })

  it('途中の行がDBエラーになると、前後の行も既存行の更新も取り消される', async () => {
    await bulk([{ shiftDate: '2026-11-02' }])

    // 0000年はzodの日付形式としては正しいが、PostgreSQLのdate型では範囲外としてエラーになる
    const res = await bulk([
      { shiftDate: '2026-11-02', startTime: '10:00' },
      { shiftDate: '0000-01-01' },
      { shiftDate: '2026-11-04' },
    ])

    expect(res.status).toBe(500)
    expect(await findShifts()).toEqual([{ shiftDate: '2026-11-02', startTime: '09:00:00' }])
  })
})

describe('POST /shifts/bulk の日付・時刻の形式', () => {
  let tenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
  })

  async function bulkFields(row: Omit<ShiftRow, 'shiftDate'> & { shiftDate?: string }) {
    const res = await apiRequest('/shifts/bulk', {
      token: tenant.users.manager.token,
      method: 'POST',
      body: {
        shifts: [
          {
            userId: tenant.users.employee.id,
            shiftDate: '2026-11-02',
            startTime: '09:00',
            endTime: '18:00',
          },
          {
            userId: tenant.users.employee.id,
            shiftDate: '2026-11-03',
            startTime: '09:00',
            endTime: '18:00',
            ...row,
          },
        ],
      },
    })
    const body = (await res.json()) as ErrorResponse
    return { status: res.status, code: body.code, fields: body.details?.map((d) => d.field) }
  }

  it.each(['not-a-date', '2026-13-01', '2026-02-30', '2026/11/03'])(
    'shiftDate に %s を指定すると400を返す',
    async (shiftDate) => {
      expect(await bulkFields({ shiftDate })).toEqual({
        status: 400,
        code: 'VALIDATION_ERROR',
        fields: ['shifts.1.shiftDate'],
      })
    },
  )

  it.each([
    ['startTime', '25:00'],
    ['startTime', '9:00'],
    ['endTime', '18:60'],
    ['endTime', 'abc'],
  ])('%s に %s を指定すると400を返す', async (field, value) => {
    expect(await bulkFields({ [field]: value })).toEqual({
      status: 400,
      code: 'VALIDATION_ERROR',
      fields: [`shifts.1.${field}`],
    })
  })

  it('HH:MM:SS 形式の時刻は受け付ける', async () => {
    const res = await apiRequest('/shifts/bulk', {
      token: tenant.users.manager.token,
      method: 'POST',
      body: {
        shifts: [
          {
            userId: tenant.users.employee.id,
            shiftDate: '2026-11-02',
            startTime: '09:00:00',
            endTime: '18:00:00',
          },
        ],
      },
    })

    expect(res.status).toBe(200)
  })
})
