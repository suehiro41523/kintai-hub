import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../index.js'
import { users } from '../schema/core.js'

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
  tenantId: string
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
      id: randomUUID(),
      tenantId: data.tenantId,
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

export async function updateUser(
  tenantId: string,
  id: string,
  data: UpdateUserData,
): Promise<MappedUser | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (data.name !== undefined) set.name = data.name
  if (data.email !== undefined) set.email = data.email
  if (data.role !== undefined) set.role = data.role
  if (data.employmentType !== undefined) set.employmentType = data.employmentType
  if (data.hourlyRate !== undefined) set.hourlyRate = data.hourlyRate?.toString() ?? null
  if (data.monthlySalary !== undefined) set.monthlySalary = data.monthlySalary?.toString() ?? null

  const [row] = await db
    .update(users)
    .set(set)
    .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
    .returning()
  return row ? mapUser(row) : null
}

export async function deactivateUser(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.tenantId, tenantId), eq(users.isActive, true)))
    .returning()
  return rows.length > 0
}
