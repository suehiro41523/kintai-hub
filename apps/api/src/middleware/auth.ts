import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types.js'

const STUB_USER_ID = '00000000-0000-0000-0000-000000000002'
const STUB_TENANT_ID = '00000000-0000-0000-0000-000000000001'

// スタブ: 本来は Better Auth でセッション検証を行う
export const verifySession = createMiddleware<AppEnv>(async (c, next) => {
  c.set('userId', STUB_USER_ID)
  c.set('role', 'employee')
  await next()
})

// スタブ: 本来は SET app.tenant_id をDBセッションに実行してRLSを有効化する
export const injectTenantContext = createMiddleware<AppEnv>(async (c, next) => {
  c.set('tenantId', STUB_TENANT_ID)
  await next()
})
