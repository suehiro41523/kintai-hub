import type { tenants } from '../db/schema/core.js'
import { isPaidPlan } from './stripe.js'

// 無料プランの人数上限。仮の値であり、LP実装時に正式な値を決める(#24)
export const FREE_PLAN_MAX_USERS = 5

type TenantForLimit = Pick<typeof tenants.$inferSelect, 'plan' | 'billedSeats' | 'maxUsers'>

// テナントに登録できる在籍(is_active = true)ユーザー数の上限を返す。null は上限なし。
// - 無料プラン: FREE_PLAN_MAX_USERS
// - 人数課金プラン(standard/pro): Stripeの契約人数(billed_seats)。Stripe未連携でbilled_seatsが無いテナント
//   (シードデータや手動設定)は max_users を使い、どちらも無ければ0人(登録不可)として扱う
// - Enterprise等のStripe外で手動運用するプラン: 上限なし(スコープ外)
export function getUserLimit(tenant: TenantForLimit): number | null {
  if (tenant.plan === 'free') return FREE_PLAN_MAX_USERS
  if (isPaidPlan(tenant.plan)) return tenant.billedSeats ?? tenant.maxUsers ?? 0
  return null
}
