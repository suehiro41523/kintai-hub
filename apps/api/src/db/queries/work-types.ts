import { and, asc, eq } from 'drizzle-orm'
import { db } from '../index.js'
import { workTypes } from '../schema/app.js'

export type WorkTypeRow = typeof workTypes.$inferSelect

export async function listWorkTypes(tenantId: string): Promise<WorkTypeRow[]> {
  return db
    .select()
    .from(workTypes)
    .where(and(eq(workTypes.tenantId, tenantId), eq(workTypes.isActive, true)))
    .orderBy(asc(workTypes.sortOrder))
}

export async function findWorkType(tenantId: string, id: string): Promise<WorkTypeRow | null> {
  const [wt] = await db
    .select()
    .from(workTypes)
    .where(
      and(eq(workTypes.id, id), eq(workTypes.tenantId, tenantId), eq(workTypes.isActive, true)),
    )
  return wt ?? null
}
