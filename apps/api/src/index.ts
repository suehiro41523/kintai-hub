import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { logger } from './lib/logger.js'

// ローカル開発用のNodeエントリーポイント。Cloudflare Workers用のエントリーポイントは
// src/worker.ts（同じ app を使い回す。詳細はTECH-STACK.md参照）
const PORT = 3001
serve({ fetch: app.fetch, port: PORT }, () => {
  logger.info({ port: PORT }, `API server started`)
})
