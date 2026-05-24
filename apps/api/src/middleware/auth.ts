import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import type { AppEnv } from '../types.js'

const COOKIE_NAME = 'kintai_session'

export const verifySession = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }

  const secret = process.env.JWT_SECRET ?? 'dev-secret'
  try {
    const payload = await verify(token, secret, 'HS256')
    c.set('userId', payload.sub as string)
    c.set('role', payload.role as string)
  } catch {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }

  await next()
})

// Phase 2: SET app.tenant_id でRLSを有効化する
export const injectTenantContext = createMiddleware<AppEnv>(async (c, next) => {
  c.set('tenantId', '00000000-0000-0000-0000-000000000001')
  await next()
})
