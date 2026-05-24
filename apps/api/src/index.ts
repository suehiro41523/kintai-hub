import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from './lib/logger.js'
import { requestLogger } from './middleware/request-logger.js'
import { billingRouter } from './routes/billing/index.js'
import { timeRecordsRouter } from './routes/time-records/index.js'
import { workTypesRouter } from './routes/work-types/index.js'
import type { AppEnv } from './types.js'

const app = new Hono<AppEnv>().basePath('/api/v1')

app.use(
  '*',
  cors({
    origin: ['http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)
app.use('*', requestLogger)

app.route('/work-types', workTypesRouter)
app.route('/time-records', timeRecordsRouter)
app.route('/billing', billingRouter)

app.get('/health', (c) => c.json({ ok: true }))

app.onError((err, c) => {
  logger.error({ err, method: c.req.method, path: c.req.path }, 'unhandled error')
  return c.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, 500)
})

const PORT = 3001
serve({ fetch: app.fetch, port: PORT }, () => {
  logger.info({ port: PORT }, `API server started`)
})
