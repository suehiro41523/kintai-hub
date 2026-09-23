import Stripe from 'stripe'

let stripeClient: Stripe | null = null

// 初回利用時に生成する。モジュール読み込み時に生成するとStripeはキー未設定で例外を投げ、
// Stripeを使わないローカル開発でもAPI全体が起動できなくなるため
export function getStripe(): Stripe {
  if (stripeClient) return stripeClient
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    throw new Error(
      'STRIPE_SECRET_KEY が設定されていません。.env に STRIPE_SECRET_KEY を設定してください。',
    )
  }
  // APIバージョンは固定しておく。Stripe側の自動更新で挙動が変わるのを防ぐため
  stripeClient = new Stripe(apiKey, { apiVersion: '2026-08-26.dahlia' })
  return stripeClient
}

export type PaidPlan = 'standard' | 'pro'

// Enterpriseは個別見積もりでStripe外で手動運用するため、ここには含めない
export const PLAN_PRICE_IDS: Record<PaidPlan, string> = {
  standard: process.env.STRIPE_PRICE_STANDARD ?? '',
  pro: process.env.STRIPE_PRICE_PRO ?? '',
}

export function isPaidPlan(plan: string): plan is PaidPlan {
  return plan === 'standard' || plan === 'pro'
}

// StripeのPrice IDからプラン名を逆引きする（Webhookでサブスクリプション内容を同期する際に使用）
export function planFromPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null
  if (priceId === PLAN_PRICE_IDS.standard) return 'standard'
  if (priceId === PLAN_PRICE_IDS.pro) return 'pro'
  return null
}
