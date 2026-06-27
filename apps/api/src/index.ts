import process from 'node:process'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/auth.js'
import { logger } from './lib/logger.js'
import { requestLogger } from './middleware/request-logger.js'
import { authRouter } from './routes/auth/index.js'
import { billingRouter } from './routes/billing/index.js'
import { reportsRouter } from './routes/reports/index.js'
import { requestsRouter } from './routes/requests/index.js'
import { shiftPatternsRouter } from './routes/shift-patterns/index.js'
import { shiftsRouter } from './routes/shifts/index.js'
import { timeRecordsRouter } from './routes/time-records/index.js'
import { usersRouter } from './routes/users/index.js'
import { workTypesRouter } from './routes/work-types/index.js'
import type { AppEnv } from './types.js'

const app = new Hono<AppEnv>().basePath('/api/v1')

app.use(
  '*',
  cors({
    origin: [(process.env.FRONTEND_URL ?? '').replace(/\/$/, '')],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)
app.use('*', requestLogger)

// /auth/me はカスタムハンドラー（core.users の tenantId/role を返す）
app.route('/auth', authRouter)
// その他の /auth/* は Better Auth が処理する（sign-in/email, sign-out, get-session 等）
app.on(['POST', 'GET'], '/auth/*', (c) => auth.handler(c.req.raw))

app.route('/work-types', workTypesRouter)
app.route('/time-records', timeRecordsRouter)
app.route('/billing', billingRouter)
app.route('/reports', reportsRouter)
app.route('/users', usersRouter)
app.route('/requests', requestsRouter)
app.route('/shift-patterns', shiftPatternsRouter)
app.route('/shifts', shiftsRouter)

app.get('/health', (c) => c.json({ ok: true }))

app.onError((err, c) => {
  logger.error({ err, method: c.req.method, path: c.req.path }, 'unhandled error')
  return c.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, 500)
})

const PORT = 3001
serve({ fetch: app.fetch, port: PORT }, () => {
  logger.info({ port: PORT }, `API server started`)
})
