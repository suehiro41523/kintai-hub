import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rateLimit } from './rate-limit.js'

// Upstash Redisには接続せず、INCR/EXPIREだけをメモリ上で再現する
const store = vi.hoisted(() => new Map<string, number>())
vi.mock('@upstash/redis', () => ({
  Redis: class {
    async incr(key: string) {
      const next = (store.get(key) ?? 0) + 1
      store.set(key, next)
      return next
    }
    async expire() {
      return 1
    }
  },
}))

const testApp = new Hono().post('/limited', rateLimit, (c) => c.text('ok'))

function post(headers: Record<string, string> = {}) {
  return testApp.request('/limited', { method: 'POST', headers })
}

describe('rateLimit', () => {
  beforeEach(() => {
    store.clear()
    vi.stubEnv('RATE_LIMIT_DISABLED', '')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Redisが未設定なら、制限なしで通さず503を返す', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')

    const res = await post()

    expect(res.status).toBe(503)
  })

  it('RATE_LIMIT_DISABLED=true なら、Redisが未設定でも通す', async () => {
    vi.stubEnv('RATE_LIMIT_DISABLED', 'true')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')

    const res = await post()

    expect(res.status).toBe(200)
  })

  it('同じ cf-connecting-ip からは、x-forwarded-for を変えても11回目で429を返す', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) {
      const res = await post({
        'cf-connecting-ip': '203.0.113.1',
        'x-forwarded-for': `198.51.100.${i}`,
      })
      statuses.push(res.status)
    }

    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true)
    expect(statuses[10]).toBe(429)
  })

  it('cf-connecting-ip が異なれば別々に数える', async () => {
    for (let i = 0; i < 10; i++) {
      await post({ 'cf-connecting-ip': '203.0.113.1' })
    }

    const res = await post({ 'cf-connecting-ip': '203.0.113.2' })

    expect(res.status).toBe(200)
  })
})
