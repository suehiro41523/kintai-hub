import process from 'node:process'
import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { cors } from 'hono/cors'
import { initDb } from './db/index.js'
import { logger } from './lib/logger.js'
import { requestLogger } from './middleware/request-logger.js'
import { authRouter } from './routes/auth/index.js'
import { billingRouter } from './routes/billing/index.js'
import { reportsRouter } from './routes/reports/index.js'
import { requestsRouter } from './routes/requests/index.js'
import { shiftPatternsRouter } from './routes/shift-patterns/index.js'
import { shiftsRouter } from './routes/shifts/index.js'
import { subscriptionRouter } from './routes/subscription/index.js'
import { timeRecordsRouter } from './routes/time-records/index.js'
import { usersRouter } from './routes/users/index.js'
import { stripeWebhookRouter } from './routes/webhooks/stripe.js'
import { workTypesRouter } from './routes/work-types/index.js'
import type { AppEnv, Bindings } from './types.js'

// Node実行(apps/api/src/index.ts)・Cloudflare Workers実行(apps/api/src/worker.ts)の
// 両方から読み込まれる共通のアプリ定義。実行環境固有の処理(serve()の起動やexport default)は
// それぞれのエントリーポイント側に置く
export const app = new Hono<AppEnv>().basePath('/api/v1')

// DB接続の初期化。ローカル(Node)ではDATABASE_URLから、Cloudflare WorkersではHyperdriveバインディング
// から接続文字列を取得する。Hyperdriveはバインディングオブジェクトのためprocess.envからは読めない
// (nodejs_compatでも同様)。initDb自体は初回のみ実接続するため毎リクエスト呼んでもコストは無視できる
app.use('*', async (c, next) => {
  const { HYPERDRIVE } = env<Bindings>(c)
  const connectionString = HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL
  if (connectionString) initDb(connectionString)
  await next()
})

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

// サインイン・サインアウト・パスワードリセット・MFA・メール確認はフロントエンドが
// Supabaseクライアントで直接Supabase Authを呼び出すため、apps/apiには来ない。
// ここに残るのは /auth/sign-up（テナント作成を伴う）と /auth/me のみ（AUTH-DESIGN.md参照）
app.route('/auth', authRouter)

app.route('/work-types', workTypesRouter)
app.route('/time-records', timeRecordsRouter)
app.route('/billing', billingRouter)
app.route('/reports', reportsRouter)
app.route('/users', usersRouter)
app.route('/requests', requestsRouter)
app.route('/shift-patterns', shiftPatternsRouter)
app.route('/shifts', shiftsRouter)
app.route('/subscription', subscriptionRouter)
// StripeからのWebhookはセッション非経由。生ボディで署名検証するため他ルートと分離している
app.route('/webhooks', stripeWebhookRouter)

app.get('/health', (c) => c.json({ ok: true }))

app.onError((err, c) => {
  logger.error({ err, method: c.req.method, path: c.req.path }, 'unhandled error')
  return c.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, 500)
})
