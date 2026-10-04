import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { db } from '../index.js'
import { tenants } from '../schema/core.js'
import { planFromPriceId } from '../../lib/stripe.js'

type TenantRow = typeof tenants.$inferSelect

export async function findTenantById(tenantId: string): Promise<TenantRow | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
  return row ?? null
}

export async function findTenantByStripeCustomerId(
  stripeCustomerId: string,
): Promise<TenantRow | null> {
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.stripeCustomerId, stripeCustomerId))
  return row ?? null
}

export async function setTenantStripeCustomerId(
  tenantId: string,
  stripeCustomerId: string,
): Promise<void> {
  await db
    .update(tenants)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
}

export async function updateBilledSeats(tenantId: string, billedSeats: number): Promise<void> {
  await db.update(tenants).set({ billedSeats, updatedAt: new Date() }).where(eq(tenants.id, tenantId))
}

// checkout.session.completed / customer.subscription.updated の両方から呼ばれる。
// Stripe側のSubscriptionオブジェクトを正として core.tenants を同期する
export async function syncSubscriptionToTenant(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const tenant = await findTenantByStripeCustomerId(customerId)
  if (!tenant) return // 該当テナントが見つからない場合は何もしない（テストWebhook等）

  const item = subscription.items.data[0]
  const priceId = item?.price.id ?? null
  const plan = planFromPriceId(priceId)

  await db
    .update(tenants)
    .set({
      plan: plan ?? tenant.plan,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
      billedSeats: item?.quantity ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id))
}

// customer.subscription.deleted 時: 解約完了としてfreeへ戻す
export async function downgradeTenantToFree(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const tenant = await findTenantByStripeCustomerId(customerId)
  if (!tenant) return

  await db
    .update(tenants)
    .set({
      plan: 'free',
      subscriptionStatus: 'canceled',
      currentPeriodEnd: null,
      billedSeats: null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id))
}
