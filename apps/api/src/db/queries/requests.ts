import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../index.js'
import { requestApprovals, requests } from '../schema/app.js'

// ─── 型定義 ───────────────────────────────────────────────────────────────────

type RequestRow = typeof requests.$inferSelect
type ApprovalRow = typeof requestApprovals.$inferSelect

export type MappedRequest = RequestRow

export type MappedRequestWithApprovals = MappedRequest & {
  approvals: ApprovalRow[]
}

// ─── クエリ ───────────────────────────────────────────────────────────────────

export async function listMyRequests(
  tenantId: string,
  userId: string,
): Promise<MappedRequest[]> {
  return db
    .select()
    .from(requests)
    .where(and(eq(requests.tenantId, tenantId), eq(requests.userId, userId)))
    .orderBy(desc(requests.createdAt))
}

export async function listPendingRequests(tenantId: string): Promise<MappedRequest[]> {
  return db
    .select()
    .from(requests)
    .where(and(eq(requests.tenantId, tenantId), eq(requests.status, 'pending')))
    .orderBy(asc(requests.createdAt))
}

export async function findRequest(
  tenantId: string,
  id: string,
): Promise<MappedRequestWithApprovals | null> {
  const [row] = await db
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.tenantId, tenantId)))
  if (!row) return null

  const approvals = await db
    .select()
    .from(requestApprovals)
    .where(eq(requestApprovals.requestId, id))
    .orderBy(asc(requestApprovals.step))

  return { ...row, approvals }
}

export type CreateRequestData = {
  tenantId: string
  userId: string
  requestType: string
  startDate?: string | null
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  reason?: string | null
}

export async function createRequest(data: CreateRequestData): Promise<MappedRequest> {
  const [row] = await db
    .insert(requests)
    .values({
      id: randomUUID(),
      tenantId: data.tenantId,
      userId: data.userId,
      requestType: data.requestType,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      targetRecordId: null,
      reason: data.reason ?? null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
  return row
}

export async function approveRequest(
  tenantId: string,
  requestId: string,
  approverId: string,
  comment?: string | null,
): Promise<MappedRequest | 'not_found' | 'not_pending'> {
  const req = await findRequest(tenantId, requestId)
  if (!req) return 'not_found'
  if (req.status !== 'pending') return 'not_pending'

  const [updated] = await db.transaction(async (tx) => {
    await tx.insert(requestApprovals).values({
      id: randomUUID(),
      requestId,
      approverId,
      step: 1,
      status: 'approved',
      comment: comment ?? null,
      approvedAt: new Date(),
    })
    return tx
      .update(requests)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(requests.id, requestId))
      .returning()
  })
  return updated
}

export async function rejectRequest(
  tenantId: string,
  requestId: string,
  approverId: string,
  comment?: string | null,
): Promise<MappedRequest | 'not_found' | 'not_pending'> {
  const req = await findRequest(tenantId, requestId)
  if (!req) return 'not_found'
  if (req.status !== 'pending') return 'not_pending'

  const [updated] = await db.transaction(async (tx) => {
    await tx.insert(requestApprovals).values({
      id: randomUUID(),
      requestId,
      approverId,
      step: 1,
      status: 'rejected',
      comment: comment ?? null,
      approvedAt: new Date(),
    })
    return tx
      .update(requests)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(requests.id, requestId))
      .returning()
  })
  return updated
}

export async function cancelRequest(
  tenantId: string,
  requestId: string,
  userId: string,
): Promise<MappedRequest | 'not_found' | 'not_pending'> {
  const [row] = await db
    .select()
    .from(requests)
    .where(
      and(
        eq(requests.id, requestId),
        eq(requests.tenantId, tenantId),
        eq(requests.userId, userId),
      ),
    )
  if (!row) return 'not_found'
  if (row.status !== 'pending') return 'not_pending'

  const [updated] = await db
    .update(requests)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(requests.id, requestId))
    .returning()
  return updated
}
