import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../index.js'
import { users } from '../schema/core.js'
import { type AuditActor, insertAuditLog } from './audit-logs.js'

// ─── 型定義 ───────────────────────────────────────────────────────────────────

type UserRow = typeof users.$inferSelect

export type MappedUser = Omit<UserRow, 'hourlyRate' | 'monthlySalary'> & {
  hourlyRate: number | null
  monthlySalary: number | null
}

function mapUser(row: UserRow): MappedUser {
  return {
    ...row,
    hourlyRate: row.hourlyRate !== null ? Number(row.hourlyRate) : null,
    monthlySalary: row.monthlySalary !== null ? Number(row.monthlySalary) : null,
  }
}

// ─── クエリ ───────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<MappedUser | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email))
  return row ? mapUser(row) : null
}

export async function findUserById(id: string): Promise<MappedUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id))
  return row ? mapUser(row) : null
}

export async function findUserByAuthUserId(authUserId: string): Promise<MappedUser | null> {
  const [row] = await db.select().from(users).where(eq(users.authUserId, authUserId))
  return row ? mapUser(row) : null
}

export async function listUsers(tenantId: string): Promise<MappedUser[]> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
    .orderBy(asc(users.name))
  return rows.map(mapUser)
}

export async function findUser(tenantId: string, id: string): Promise<MappedUser | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
  return row ? mapUser(row) : null
}

export type CreateUserData = {
  id?: string
  tenantId: string
  authUserId: string
  name: string
  email: string
  role: string
  employmentType: string
  hourlyRate?: number | null
  monthlySalary?: number | null
}

export async function createUser(data: CreateUserData): Promise<MappedUser> {
  const [row] = await db
    .insert(users)
    .values({
      id: data.id ?? randomUUID(),
      tenantId: data.tenantId,
      authUserId: data.authUserId,
      name: data.name,
      email: data.email,
      role: data.role,
      employmentType: data.employmentType,
      hourlyRate: data.hourlyRate?.toString() ?? null,
      monthlySalary: data.monthlySalary?.toString() ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
  return mapUser(row)
}

export type UpdateUserData = Partial<Omit<CreateUserData, 'tenantId'>>

// 従業員情報の更新(ロール変更を含む)。更新と監査ログを1つのトランザクションで行う。
// 監査ログには、リクエストで指定された項目だけ変更前後の値を残す
export async function updateUser(
  tenantId: string,
  id: string,
  data: UpdateUserData,
  actor: AuditActor,
): Promise<MappedUser | null> {
  const before = await findUser(tenantId, id)
  if (!before) return null

  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (data.name !== undefined) set.name = data.name
  if (data.email !== undefined) set.email = data.email
  if (data.role !== undefined) set.role = data.role
  if (data.employmentType !== undefined) set.employmentType = data.employmentType
  if (data.hourlyRate !== undefined) set.hourlyRate = data.hourlyRate?.toString() ?? null
  if (data.monthlySalary !== undefined) set.monthlySalary = data.monthlySalary?.toString() ?? null

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set(set)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning()
    const after = mapUser(row)
    const changedKeys = (Object.keys(data) as (keyof UpdateUserData)[]).filter(
      (key) => data[key] !== undefined,
    )
    await insertAuditLog(tx, {
      tenantId,
      actor,
      action: 'update',
      resourceType: 'user',
      resourceId: id,
      beforeValue: Object.fromEntries(changedKeys.map((key) => [key, before[key]])),
      afterValue: Object.fromEntries(changedKeys.map((key) => [key, after[key]])),
    })
    return after
  })
}

// 従業員の無効化。更新と監査ログを1つのトランザクションで行う
export async function deactivateUser(
  tenantId: string,
  id: string,
  actor: AuditActor,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId), eq(users.isActive, true)))
      .returning()
    if (rows.length === 0) return false
    await insertAuditLog(tx, {
      tenantId,
      actor,
      action: 'deactivate',
      resourceType: 'user',
      resourceId: id,
      beforeValue: { isActive: true },
      afterValue: { isActive: false },
    })
    return true
  })
}
