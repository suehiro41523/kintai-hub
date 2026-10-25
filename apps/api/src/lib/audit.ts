import type { Context } from 'hono'
import type { AuditActor } from '../db/queries/audit-logs.js'
import type { AppEnv } from '../types.js'

// 監査ログに残す操作者の情報をリクエストから取り出す。
// IPはCloudflareが付与する cf-connecting-ip を使う(x-forwarded-for は利用者が書き換えられるため記録しない)
export function getAuditActor(c: Context<AppEnv>): AuditActor {
  return {
    userId: c.get('userId'),
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  }
}
