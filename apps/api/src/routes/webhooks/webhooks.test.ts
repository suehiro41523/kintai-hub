import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../../app.js'

// Stripeと同じ形式(t=<時刻>,v1=<HMAC-SHA256>)の署名を、指定した鍵で作る
function sign(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

const payload = JSON.stringify({
  id: 'evt_test',
  object: 'event',
  type: 'invoice.payment_failed',
  data: { object: {} },
})

function postWebhook(signature: string) {
  return app.request('/api/v1/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature, 'Content-Type': 'application/json' },
    body: payload,
  })
}

describe('POST /webhooks/stripe', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_dummy')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('STRIPE_WEBHOOK_SECRET が未設定なら、空の鍵で作った署名でも処理せず500を返す', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')

    const res = await postWebhook(sign(payload, ''))

    expect(res.status).toBe(500)
  })

  it('STRIPE_WEBHOOK_SECRET と異なる鍵で作った署名は400を返す', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_correct')

    const res = await postWebhook(sign(payload, 'whsec_wrong'))

    expect(res.status).toBe(400)
  })

  it('STRIPE_WEBHOOK_SECRET で作った正しい署名なら処理する', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_correct')

    const res = await postWebhook(sign(payload, 'whsec_correct'))

    expect(res.status).toBe(200)
  })
})
