import { randomUUID } from 'node:crypto'
import { and, asc, between, eq, inArray } from 'drizzle-orm'
import { db } from '../index.js'
import { shiftPatterns, shifts, workTypes } from '../schema/app.js'
import { users } from '../schema/core.js'

// ─── 型定義 ───────────────────────────────────────────────────────────────────

type ShiftRow = typeof shifts.$inferSelect
type ShiftPatternRow = typeof shiftPatterns.$inferSelect

export type MappedShift = ShiftRow
export type MappedShiftPattern = ShiftPatternRow

// ─── ShiftPatterns ────────────────────────────────────────────────────────────

export async function listShiftPatterns(tenantId: string): Promise<MappedShiftPattern[]> {
  return db
    .select()
    .from(shiftPatterns)
    .where(eq(shiftPatterns.tenantId, tenantId))
    .orderBy(asc(shiftPatterns.name))
}

export type CreateShiftPatternData = {
  tenantId: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
}

export async function createShiftPattern(
  data: CreateShiftPatternData,
): Promise<MappedShiftPattern> {
  const [row] = await db
    .insert(shiftPatterns)
    .values({
      id: randomUUID(),
      tenantId: data.tenantId,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      breakMinutes: data.breakMinutes,
    })
    .returning()
  return row
}

export async function updateShiftPattern(
  tenantId: string,
  id: string,
  data: Partial<Omit<CreateShiftPatternData, 'tenantId'> & { isActive: boolean }>,
): Promise<MappedShiftPattern | null> {
  const [row] = await db
    .update(shiftPatterns)
    .set(data)
    .where(and(eq(shiftPatterns.id, id), eq(shiftPatterns.tenantId, tenantId)))
    .returning()
  return row ?? null
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function listMyShifts(
  tenantId: string,
  userId: string,
  from: string,
  to: string,
): Promise<MappedShift[]> {
  return db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.tenantId, tenantId),
        eq(shifts.userId, userId),
        between(shifts.shiftDate, from, to),
      ),
    )
    .orderBy(asc(shifts.shiftDate))
}

export async function listTeamShifts(
  tenantId: string,
  from: string,
  to: string,
  userId?: string,
): Promise<MappedShift[]> {
  return db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.tenantId, tenantId),
        between(shifts.shiftDate, from, to),
        userId ? eq(shifts.userId, userId) : undefined,
      ),
    )
    .orderBy(asc(shifts.shiftDate), asc(shifts.userId))
}

export type UpsertShiftItem = {
  userId: string
  shiftDate: string
  startTime: string
  endTime: string
  workTypeId?: string | null
  shiftPatternId?: string | null
}

export type UpsertResult = {
  created: MappedShift[]
  updated: MappedShift[]
}

export type InvalidShiftReference = { field: string; message: string }

// リクエストに含まれるID（従業員・ワークタイプ・シフトパターン）のうち、自テナントに存在しない・無効なものを返す。
// 外部キーはテナントを区別しないため、確認しないと他テナントのIDを参照するシフトを登録できてしまう。
// field は zod のバリデーションエラーと同じ `shifts.<行番号>.<項目>` の形にする
export async function findInvalidShiftReferences(
  tenantId: string,
  items: UpsertShiftItem[],
): Promise<InvalidShiftReference[]> {
  const unique = (ids: (string | null | undefined)[]) =>
    [...new Set(ids.filter((id): id is string => typeof id === 'string'))]
  const userIds = unique(items.map((i) => i.userId))
  const workTypeIds = unique(items.map((i) => i.workTypeId))
  const shiftPatternIds = unique(items.map((i) => i.shiftPatternId))

  const [validUsers, validWorkTypes, validShiftPatterns] = await Promise.all([
    db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.tenantId, tenantId), eq(users.isActive, true), inArray(users.id, userIds)),
      ),
    workTypeIds.length > 0
      ? db
          .select({ id: workTypes.id })
          .from(workTypes)
          .where(
            and(
              eq(workTypes.tenantId, tenantId),
              eq(workTypes.isActive, true),
              inArray(workTypes.id, workTypeIds),
            ),
          )
      : Promise.resolve([]),
    shiftPatternIds.length > 0
      ? db
          .select({ id: shiftPatterns.id })
          .from(shiftPatterns)
          .where(
            and(
              eq(shiftPatterns.tenantId, tenantId),
              eq(shiftPatterns.isActive, true),
              inArray(shiftPatterns.id, shiftPatternIds),
            ),
          )
      : Promise.resolve([]),
  ])
  const validUserIds = new Set(validUsers.map((r) => r.id))
  const validWorkTypeIds = new Set(validWorkTypes.map((r) => r.id))
  const validShiftPatternIds = new Set(validShiftPatterns.map((r) => r.id))

  const invalid: InvalidShiftReference[] = []
  items.forEach((item, i) => {
    if (!validUserIds.has(item.userId)) {
      invalid.push({ field: `shifts.${i}.userId`, message: '指定された従業員が存在しません' })
    }
    if (item.workTypeId && !validWorkTypeIds.has(item.workTypeId)) {
      invalid.push({
        field: `shifts.${i}.workTypeId`,
        message: '指定されたワークタイプが存在しません',
      })
    }
    if (item.shiftPatternId && !validShiftPatternIds.has(item.shiftPatternId)) {
      invalid.push({
        field: `shifts.${i}.shiftPatternId`,
        message: '指定されたシフトパターンが存在しません',
      })
    }
  })
  return invalid
}

// 1行でも失敗したら全件を登録しない(半分だけ登録されたシフト表を作らないため)。
// 例外は握りつぶさずに投げ、リクエスト全体のトランザクションごとロールバックさせる。
// 行ごとにtry/catchして続行すると、PostgreSQLはトランザクション内で1つでもSQLが失敗すると
// 以降のSQLがすべて失敗し、成功扱いにした行もコミットされないため、レスポンスとDBが食い違う
export async function upsertShifts(
  tenantId: string,
  createdBy: string,
  items: UpsertShiftItem[],
): Promise<UpsertResult> {
  const created: MappedShift[] = []
  const updated: MappedShift[] = []

  await db.transaction(async (tx) => {
    for (const item of items) {
      const [existing] = await tx
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.tenantId, tenantId),
            eq(shifts.userId, item.userId),
            eq(shifts.shiftDate, item.shiftDate),
          ),
        )

      if (existing) {
        const [row] = await tx
          .update(shifts)
          .set({
            startTime: item.startTime,
            endTime: item.endTime,
            workTypeId: item.workTypeId ?? null,
            shiftPatternId: item.shiftPatternId ?? null,
          })
          .where(and(eq(shifts.id, existing.id), eq(shifts.tenantId, tenantId)))
          .returning()
        updated.push(row)
      } else {
        const [row] = await tx
          .insert(shifts)
          .values({
            id: randomUUID(),
            tenantId,
            userId: item.userId,
            shiftDate: item.shiftDate,
            startTime: item.startTime,
            endTime: item.endTime,
            workTypeId: item.workTypeId ?? null,
            shiftPatternId: item.shiftPatternId ?? null,
            status: 'scheduled',
            createdBy,
          })
          .returning()
        created.push(row)
      }
    }
  })

  return { created, updated }
}

export async function deleteShift(tenantId: string, id: string): Promise<boolean> {
  const [row] = await db
    .delete(shifts)
    .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
    .returning()
  return !!row
}
