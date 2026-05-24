import { randomUUID } from 'node:crypto'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import type { ActiveSession, DaySummary, RecordType } from '../../types.js'
import { db } from '../index.js'
import { timeRecords } from '../schema/app.js'
import type { WorkTypeRow } from './work-types.js'

export type TimeRecordRow = typeof timeRecords.$inferSelect

// decimal カラムは postgres-js が文字列で返すため数値に変換する
export type MappedTimeRecord = Omit<TimeRecordRow, 'locationLat' | 'locationLng'> & {
  locationLat: number | null
  locationLng: number | null
}

function mapRecord(row: TimeRecordRow): MappedTimeRecord {
  return {
    ...row,
    locationLat: row.locationLat !== null ? Number(row.locationLat) : null,
    locationLng: row.locationLng !== null ? Number(row.locationLng) : null,
  }
}

export async function listTodayRecords(
  userId: string,
  tenantId: string,
): Promise<MappedTimeRecord[]> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const rows = await db
    .select()
    .from(timeRecords)
    .where(
      and(
        eq(timeRecords.userId, userId),
        eq(timeRecords.tenantId, tenantId),
        gte(timeRecords.clockedAt, todayStart),
        lte(timeRecords.clockedAt, todayEnd),
      ),
    )
    .orderBy(asc(timeRecords.clockedAt))

  return rows.map(mapRecord)
}

export type InsertTimeRecord = {
  userId: string
  tenantId: string
  workTypeId: string
  recordType: RecordType
  clockedAt: Date
  deviceType: string
  locationLat: number | null
  locationLng: number | null
  isModified: boolean
}

export async function insertTimeRecord(data: InsertTimeRecord): Promise<MappedTimeRecord> {
  const [row] = await db
    .insert(timeRecords)
    .values({
      id: randomUUID(),
      ...data,
      locationLat: data.locationLat?.toString() ?? null,
      locationLng: data.locationLng?.toString() ?? null,
      createdAt: new Date(),
    })
    .returning()
  return mapRecord(row)
}

export async function switchWorkType(params: {
  userId: string
  tenantId: string
  fromWorkTypeId: string
  toWorkTypeId: string
  locationLat: number | null
  locationLng: number | null
}): Promise<{ clockOutRecord: MappedTimeRecord; clockInRecord: MappedTimeRecord }> {
  const now = new Date()
  const base = {
    userId: params.userId,
    tenantId: params.tenantId,
    clockedAt: now,
    deviceType: 'web',
    locationLat: params.locationLat?.toString() ?? null,
    locationLng: params.locationLng?.toString() ?? null,
    isModified: false,
    createdAt: now,
  }

  return db.transaction(async (tx) => {
    const [clockOutRow] = await tx
      .insert(timeRecords)
      .values({
        id: randomUUID(),
        ...base,
        workTypeId: params.fromWorkTypeId,
        recordType: 'clock_out',
      })
      .returning()
    const [clockInRow] = await tx
      .insert(timeRecords)
      .values({
        id: randomUUID(),
        ...base,
        workTypeId: params.toWorkTypeId,
        recordType: 'clock_in',
      })
      .returning()
    return { clockOutRecord: mapRecord(clockOutRow), clockInRecord: mapRecord(clockInRow) }
  })
}

// ─── ビジネスロジック（純粋関数） ─────────────────────────────────────────────

export function deriveActiveSession(records: MappedTimeRecord[]): ActiveSession | null {
  let currentWorkTypeId: string | null = null
  let clockedInAt: Date | null = null
  let isOnBreak = false
  let breakStartedAt: Date | null = null

  for (const r of records) {
    switch (r.recordType as RecordType) {
      case 'clock_in':
        currentWorkTypeId = r.workTypeId
        clockedInAt = r.clockedAt
        isOnBreak = false
        breakStartedAt = null
        break
      case 'clock_out':
        currentWorkTypeId = null
        clockedInAt = null
        isOnBreak = false
        breakStartedAt = null
        break
      case 'break_start':
        isOnBreak = true
        breakStartedAt = r.clockedAt
        break
      case 'break_end':
        isOnBreak = false
        breakStartedAt = null
        break
    }
  }

  if (!currentWorkTypeId || !clockedInAt) return null
  return {
    workTypeId: currentWorkTypeId,
    clockedInAt: clockedInAt.toISOString(),
    isOnBreak,
    breakStartedAt: breakStartedAt?.toISOString() ?? null,
  }
}

export function calcDaySummary(
  records: MappedTimeRecord[],
  workTypeRows: WorkTypeRow[],
): DaySummary {
  const workTypeMap = new Map(workTypeRows.map((w) => [w.id, w.name]))
  const netMsByType = new Map<string, number>()
  let totalBreakMs = 0

  const grouped = new Map<string, MappedTimeRecord[]>()
  for (const r of records) {
    if (!grouped.has(r.workTypeId)) grouped.set(r.workTypeId, [])
    grouped.get(r.workTypeId)?.push(r)
  }

  for (const [wtId, recs] of grouped) {
    let activeStart: Date | null = null
    let netMs = 0

    for (const r of recs) {
      switch (r.recordType as RecordType) {
        case 'clock_in':
          activeStart = r.clockedAt
          break
        case 'break_start':
          if (activeStart) {
            netMs += r.clockedAt.getTime() - activeStart.getTime()
            activeStart = null
          }
          break
        case 'break_end': {
          const prevBreakStart = recs
            .filter((b) => b.recordType === 'break_start' && b.clockedAt < r.clockedAt)
            .at(-1)
          if (prevBreakStart) {
            totalBreakMs += r.clockedAt.getTime() - prevBreakStart.clockedAt.getTime()
          }
          activeStart = r.clockedAt
          break
        }
        case 'clock_out':
          if (activeStart) {
            netMs += r.clockedAt.getTime() - activeStart.getTime()
            activeStart = null
          }
          break
      }
    }
    netMsByType.set(wtId, (netMsByType.get(wtId) ?? 0) + netMs)
  }

  const workTypeBreakdown = Array.from(netMsByType.entries())
    .filter(([, ms]) => ms > 0)
    .map(([workTypeId, ms]) => ({
      workTypeId,
      workTypeName: workTypeMap.get(workTypeId) ?? workTypeId,
      minutes: Math.floor(ms / 60000),
    }))

  const totalMin = workTypeBreakdown.reduce((s, b) => s + b.minutes, 0)
  return { totalMin, breakMin: Math.floor(totalBreakMs / 60000), workTypeBreakdown }
}
