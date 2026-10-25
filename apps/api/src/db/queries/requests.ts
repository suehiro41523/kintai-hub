import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { Role } from '../../types.js'
import { db } from '../index.js'
import { requestApprovals, requests } from '../schema/app.js'
import { type AuditActor, insertAuditLog } from './audit-logs.js'

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

export type DecideRequestResult = MappedRequest | 'not_found' | 'not_pending' | 'self_decision'

// 申請の承認・却下。承認履歴(request_approvals)・申請の状態・監査ログを1つのトランザクションで更新する。
// managerは自分の申請を承認・却下できない(本人による勤怠の改ざんを防ぐため)。adminは自分の申請も承認・却下してよい
async function decideRequest(
  tenantId: string,
  requestId: string,
  actor: AuditActor,
  actorRole: Role,
  decision: 'approved' | 'rejected',
  comment?: string | null,
): Promise<DecideRequestResult> {
  const req = await findRequest(tenantId, requestId)
  if (!req) return 'not_found'
  if (req.userId === actor.userId && actorRole !== 'admin') return 'self_decision'
  if (req.status !== 'pending') return 'not_pending'

  return db.transaction(async (tx) => {
    await tx.insert(requestApprovals).values({
      id: randomUUID(),
      tenantId,
      requestId,
      approverId: actor.userId,
      step: 1,
      status: decision,
      comment: comment ?? null,
      approvedAt: new Date(),
    })
    const [updated] = await tx
      .update(requests)
      .set({ status: decision, updatedAt: new Date() })
      .where(and(eq(requests.id, requestId), eq(requests.tenantId, tenantId)))
      .returning()
    await insertAuditLog(tx, {
      tenantId,
      actor,
      action: decision === 'approved' ? 'approve' : 'reject',
      resourceType: 'request',
      resourceId: requestId,
      beforeValue: { status: req.status },
      afterValue: { status: decision, comment: comment ?? null },
    })
    return updated
  })
}

export function approveRequest(
  tenantId: string,
  requestId: string,
  actor: AuditActor,
  actorRole: Role,
  comment?: string | null,
): Promise<DecideRequestResult> {
  return decideRequest(tenantId, requestId, actor, actorRole, 'approved', comment)
}

export function rejectRequest(
  tenantId: string,
  requestId: string,
  actor: AuditActor,
  actorRole: Role,
  comment?: string | null,
): Promise<DecideRequestResult> {
  return decideRequest(tenantId, requestId, actor, actorRole, 'rejected', comment)
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
