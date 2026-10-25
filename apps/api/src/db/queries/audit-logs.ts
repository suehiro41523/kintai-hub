import { randomUUID } from 'node:crypto'
import type { Tx } from '../index.js'
import { auditLogs } from '../schema/app.js'

// 操作した本人と、操作元の情報(監査ログの「誰が・どこから」)
export type AuditActor = {
  userId: string
  ipAddress: string | null
  userAgent: string | null
}

export type AuditLogEntry = {
  tenantId: string
  actor: AuditActor
  action: 'update' | 'approve' | 'reject' | 'deactivate'
  resourceType: 'time_record' | 'request' | 'user'
  resourceId: string
  beforeValue: Record<string, unknown>
  afterValue: Record<string, unknown>
}

// 業務データの更新と同じトランザクション(tx)で呼ぶこと。
// 別トランザクションにすると、更新だけ成功してログが残らない(またはその逆の)状態になりうる。
// audit_logs は INSERT のみ。UPDATE / DELETE は禁止(CLAUDE.md 絶対ルール3。DB側でも権限で禁止している)
export async function insertAuditLog(tx: Tx, entry: AuditLogEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    id: randomUUID(),
    tenantId: entry.tenantId,
    userId: entry.actor.userId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    beforeValue: entry.beforeValue,
    afterValue: entry.afterValue,
    ipAddress: entry.actor.ipAddress,
    userAgent: entry.actor.userAgent,
  })
}
