import { sql } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { db } from '../db/index.js'
import { findUserByAuthUserId } from '../db/queries/users.js'
import { verifyAccessToken } from '../lib/supabase.js'
import type { AppEnv, Role } from '../types.js'

const isValidRole = (role: string): role is Role =>
  role === 'admin' || role === 'manager' || role === 'employee'

export const verifySession = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }

  const payload = await verifyAccessToken(token)
  if (!payload) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }

  const coreUser = await findUserByAuthUserId(payload.sub)
  if (!coreUser || !coreUser.isActive) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }

  if (!isValidRole(coreUser.role)) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }

  c.set('userId', coreUser.id)
  c.set('tenantId', coreUser.tenantId)
  c.set('role', coreUser.role)

  await next()
})

export const injectTenantContext = createMiddleware<AppEnv>(async (c, next) => {
  const tenantId = c.get('tenantId')
  if (!tenantId) {
    return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  }
  await db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`)
  await next()
})

export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get('role')
    if (!roles.includes(role)) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
    }
    await next()
  })
