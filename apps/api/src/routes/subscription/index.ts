import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  findTenantById,
  setTenantStripeCustomerId,
  updateBilledSeats,
} from '../../db/queries/subscription.js'
import { logger } from '../../lib/logger.js'
import { getStripe, isPaidPlan, PLAN_PRICE_IDS } from '../../lib/stripe.js'
import { injectTenantContext, requireRole, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const CheckoutSchema = z.object({
  plan: z.enum(['standard', 'pro']),
  seats: z.number().int().min(1).max(9999),
})

const SeatsSchema = z.object({
  seats: z.number().int().min(1).max(9999),
})

const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export const subscriptionRouter = new Hono<AppEnv>()

  .get('/', verifySession, injectTenantContext, requireRole('admin', 'manager'), async (c) => {
    const tenantId = c.get('tenantId')
    const tenant = await findTenantById(tenantId)
    if (!tenant) {
      return c.json({ error: 'テナントが見つかりません', code: 'NOT_FOUND' }, 404)
    }
    return c.json({
      subscription: {
        plan: tenant.plan,
        status: tenant.subscriptionStatus,
        currentPeriodEnd: tenant.currentPeriodEnd,
        billedSeats: tenant.billedSeats,
        hasStripeCustomer: tenant.stripeCustomerId !== null,
      },
    })
  })

  // 無料プランからの有料プラン加入・プラン変更。Stripe Checkoutへリダイレクトさせるためのセッション発行
  .post(
    '/checkout',
    verifySession,
    injectTenantContext,
    requireRole('admin'),
    zValidator('json', CheckoutSchema),
    async (c) => {
      const { plan, seats } = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const tenant = await findTenantById(tenantId)
      if (!tenant) {
        return c.json({ error: 'テナントが見つかりません', code: 'NOT_FOUND' }, 404)
      }

      const priceId = PLAN_PRICE_IDS[plan]
      if (!priceId) {
        logger.error({ plan }, 'stripe_price_id_not_configured')
        return c.json({ error: 'プランを利用できません', code: 'PLAN_UNAVAILABLE' }, 500)
      }

      // Stripe Customerはテナントごとに1つだけ作る。既にあれば使い回す
      let stripeCustomerId = tenant.stripeCustomerId
      if (!stripeCustomerId) {
        const customer = await getStripe().customers.create({
          name: tenant.name,
          metadata: { tenantId },
        })
        stripeCustomerId = customer.id
        await setTenantStripeCustomerId(tenantId, stripeCustomerId)
      }

      const session = await getStripe().checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: seats }],
        subscription_data: { metadata: { tenantId } },
        allow_promotion_codes: true,
        success_url: `${FRONTEND_URL}/settings/subscription?checkout=success`,
        cancel_url: `${FRONTEND_URL}/settings/subscription?checkout=cancelled`,
      })

      logger.info({ tenantId, plan, seats }, 'stripe_checkout_session_created')
      return c.json({ url: session.url })
    },
  )

  // 請求情報の確認・支払い方法変更・解約はStripe Customer Portalに委譲する
  .post('/portal', verifySession, injectTenantContext, requireRole('admin'), async (c) => {
    const tenantId = c.get('tenantId')
    const tenant = await findTenantById(tenantId)
    if (!tenant?.stripeCustomerId) {
      return c.json(
        { error: 'サブスクリプションが未開始です', code: 'NO_SUBSCRIPTION' },
        400,
      )
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${FRONTEND_URL}/settings/subscription`,
    })

    return c.json({ url: session.url })
  })

  // 人数課金プランの契約人数を管理画面から手動調整する（自動同期は行わない）
  .patch(
    '/seats',
    verifySession,
    injectTenantContext,
    requireRole('admin'),
    zValidator('json', SeatsSchema),
    async (c) => {
      const { seats } = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const tenant = await findTenantById(tenantId)
      if (!tenant) {
        return c.json({ error: 'テナントが見つかりません', code: 'NOT_FOUND' }, 404)
      }
      if (!tenant.stripeSubscriptionId || !isPaidPlan(tenant.plan)) {
        return c.json(
          { error: '有料プランに加入していません', code: 'NO_SUBSCRIPTION' },
          400,
        )
      }

      const subscription = await getStripe().subscriptions.retrieve(tenant.stripeSubscriptionId)
      const item = subscription.items.data[0]
      if (!item) {
        return c.json({ error: 'サブスクリプションが不正です', code: 'INVALID_SUBSCRIPTION' }, 500)
      }

      await getStripe().subscriptionItems.update(item.id, { quantity: seats })
      // Webhook(customer.subscription.updated)でも同期されるが、UIへの反映を即時にするためここでも更新する
      await updateBilledSeats(tenantId, seats)

      logger.info({ tenantId, seats }, 'stripe_seats_updated')
      return c.json({ success: true, billedSeats: seats })
    },
  )
