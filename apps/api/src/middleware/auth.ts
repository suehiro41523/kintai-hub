import { sql } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { db } from '../db/index.js'
import { findUserById } from '../db/queries/users.js'
import { auth } from '../lib/auth.js'
import type { AppEnv } from '../types.js'

export const verifySession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session?.user) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }

  const coreUser = await findUserById(session.user.id)
  if (!coreUser || !coreUser.isActive) {
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
