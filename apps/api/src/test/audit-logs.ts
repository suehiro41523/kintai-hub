import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { auditLogs } from '../db/schema/app.js'

// 指定したリソースの監査ログを、テストで比較しやすい項目だけにして返す
export async function findAuditLogs(tenantId: string, resourceId: string) {
  return db
    .select({
      userId: auditLogs.userId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      beforeValue: auditLogs.beforeValue,
      afterValue: auditLogs.afterValue,
      ipAddress: auditLogs.ipAddress,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.resourceId, resourceId)))
}
