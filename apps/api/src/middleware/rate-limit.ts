import { Redis } from '@upstash/redis'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { logger } from '../lib/logger.js'

// api-spec.md 共通仕様: 認証エンドポイントは 10req/min
const WINDOW_SECONDS = 60
const MAX_REQUESTS = 10

// 環境変数はリクエストのたびに読む(Workersではモジュール読み込み時に値が無い場合があるため)
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? new Redis({ url, token }) : null
}

// Cloudflareが付与する cf-connecting-ip を使う。Cloudflareは利用者が送った同名ヘッダーを上書きするため偽装できない。
// x-forwarded-for は利用者が自由に書き換えられ、値を変えるだけで制限を回避できるため使わない。
// cf-connecting-ip が無いのはローカル開発(Node)のときだけなので、まとめて1つの枠で数える
function getClientIp(c: Context): string {
  return c.req.header('cf-connecting-ip') ?? 'local'
}

// sign-up・send-verification-email 等のBot対策用レート制限（IPアドレス単位、固定ウィンドウ）。
// Redisが未設定のときは制限なしで通さず503を返す。ローカル開発などで意図的に無効にする場合だけ
// RATE_LIMIT_DISABLED=true を設定する
export const rateLimit = createMiddleware(async (c, next) => {
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    await next()
    return
  }

  const redis = getRedis()
  if (!redis) {
    logger.error(
      'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が未設定のため、レート制限対象のリクエストを拒否しました',
    )
    return c.json(
      { error: '現在このリクエストを受け付けられません', code: 'SERVICE_UNAVAILABLE' },
      503,
    )
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
