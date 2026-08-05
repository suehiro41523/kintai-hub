import { Redis } from '@upstash/redis'
import { createMiddleware } from 'hono/factory'
import { logger } from '../lib/logger.js'

// api-spec.md 共通仕様: 認証エンドポイントは 10req/min
const WINDOW_SECONDS = 60
const MAX_REQUESTS = 10

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null

if (!redis) {
  logger.warn(
    'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が未設定のため、レート制限は無効化されています',
  )
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'unknown'
}

// sign-up・send-verification-email 等のBot対策用レート制限（IPアドレス単位、固定ウィンドウ）
export const rateLimit = createMiddleware(async (c, next) => {
  if (!redis) {
    await next()
    return
  }

  const key = `rate-limit:${c.req.path}:${getClientIp(c)}`
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS)
  }

  if (count > MAX_REQUESTS) {
    return c.json(
      { error: '試行回数が上限に達しました。しばらくしてから再度お試しください', code: 'RATE_LIMITED' },
      429,
    )
  }

  await next()
})
