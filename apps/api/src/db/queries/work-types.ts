import { randomUUID } from 'node:crypto'
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

export async function createWorkType(data: {
  tenantId: string
  name: string
  color: string
  billingType: string
  isBillable: boolean
  sortOrder: number
}): Promise<WorkTypeRow> {
  const [row] = await db
    .insert(workTypes)
    .values({ id: randomUUID(), ...data, isActive: true, createdAt: new Date() })
    .returning()
  return row
}

export async function updateWorkType(
  tenantId: string,
  id: string,
  data: {
    name?: string
    color?: string
    billingType?: string
    isBillable?: boolean
    sortOrder?: number
  },
): Promise<WorkTypeRow | null> {
  const [row] = await db
    .update(workTypes)
    .set(data)
    .where(and(eq(workTypes.id, id), eq(workTypes.tenantId, tenantId)))
    .returning()
  return row ?? null
}

export async function deactivateWorkType(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(workTypes)
    .set({ isActive: false })
    .where(
      and(eq(workTypes.id, id), eq(workTypes.tenantId, tenantId), eq(workTypes.isActive, true)),
    )
    .returning()
  return rows.length > 0
}

export async function reorderWorkTypes(
  tenantId: string,
  orders: { id: string; sortOrder: number }[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await Promise.all(
      orders.map(({ id, sortOrder }) =>
        tx
          .update(workTypes)
          .set({ sortOrder })
          .where(and(eq(workTypes.id, id), eq(workTypes.tenantId, tenantId))),
      ),
    )
  })
}
