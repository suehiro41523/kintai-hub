import { Hono } from 'hono'
import type Stripe from 'stripe'
import { downgradeTenantToFree, syncSubscriptionToTenant } from '../../db/queries/subscription.js'
import { logger } from '../../lib/logger.js'
import { getStripe } from '../../lib/stripe.js'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

export const stripeWebhookRouter = new Hono()

  // Stripeからのサーバー間通知。セッション認証もCORSも通さない生エンドポイント。
  // 署名検証のため、JSONパース前の生ボディをそのまま使う必要がある
  .post('/stripe', async (c) => {
    const signature = c.req.header('stripe-signature')
    if (!signature) {
      return c.json({ error: 'signature missing', code: 'VALIDATION_ERROR' }, 400)
    }

    const rawBody = await c.req.text()
    let event: Stripe.Event
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err) {
      logger.error({ err }, 'stripe_webhook_signature_invalid')
      return c.json({ error: 'invalid signature', code: 'VALIDATION_ERROR' }, 400)
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (typeof session.subscription === 'string') {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription)
          await syncSubscriptionToTenant(subscription)
        }
        break
      }
      case 'customer.subscription.updated': {
        await syncSubscriptionToTenant(event.data.object)
        break
      }
      case 'customer.subscription.deleted': {
        await downgradeTenantToFree(event.data.object)
        break
      }
      case 'invoice.payment_failed': {
        // 状態遷移（past_due等）自体はStripeがcustomer.subscription.updatedを追って発火するのでそちらで同期する。
        // ここではオペレーション把握のためログのみ残す
        logger.warn({ eventId: event.id }, 'stripe_invoice_payment_failed')
        break
      }
      default:
        break
    }

    logger.info({ type: event.type, id: event.id }, 'stripe_webhook_processed')
    return c.json({ received: true })
  })
