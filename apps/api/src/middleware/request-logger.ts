import { createMiddleware } from 'hono/factory'
import { logger } from '../lib/logger.js'
import type { AppEnv } from '../types.js'

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start

  const userId = c.get('userId')
  const tenantId = c.get('tenantId')
  const status = c.res.status

  const bindings: Record<string, unknown> = {
    method: c.req.method,
    path: c.req.path,
    status,
    ms,
  }
  if (userId) bindings.userId = userId
  if (tenantId) bindings.tenantId = tenantId

  const level: 'error' | 'warn' | 'info' = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

  logger[level](bindings, `${c.req.method} ${c.req.path}`)
})
