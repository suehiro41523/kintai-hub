'use client'

import { CheckCircle2, CreditCard, Loader2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMe } from '@/hooks/useAuth'
import {
  useCreateCheckoutSession,
  useCreatePortalSession,
  useSubscription,
  useUpdateSeats,
} from '@/hooks/useSubscription'
import type { PaidPlan } from '@/lib/apiClient'

// ─── 定数 ─────────────────────────────────────────────────────────────────────
// 金額は仮価格（docs/screens/top-page-design.md 4.9参照）。正式確定後に差し替える

interface PlanDef {
  id: string
  name: string
  price: string
  unit: string
  desc: string
}

const PLANS: PlanDef[] = [
  { id: 'free', name: 'Free', price: '¥0', unit: '', desc: '〜5名・基本機能のみ' },
  { id: 'standard', name: 'Standard', price: '¥400', unit: '/人・月', desc: '6〜50名・精算機能フル対応' },
  { id: 'pro', name: 'Pro', price: '¥700', unit: '/人・月', desc: '51〜300名・複数精算方式並行' },
  { id: 'enterprise', name: 'Enterprise', price: '個別見積もり', unit: '', desc: '301名〜・専任サポート' },
]

const STATUS_LABELS: Record<string, string> = {
  active: '有効',
  trialing: 'トライアル中',
  past_due: '支払い遅延',
  canceled: '解約済み',
  unpaid: '未払い',
  incomplete: '未完了',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default function SubscriptionPage() {
  const { data: me } = useMe()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: subscription, isLoading } = useSubscription()
  const checkout = useCreateCheckoutSession()
  const portal = useCreatePortalSession()
  const updateSeats = useUpdateSeats()

  const [seatsInput, setSeatsInput] = useState('')
  const [seatsForCheckout, setSeatsForCheckout] = useState<Record<string, string>>({})

  useEffect(() => {
    if (me && me.role !== 'admin') router.replace('/clock')
  }, [me, router])

  useEffect(() => {
    if (subscription?.billedSeats != null) setSeatsInput(String(subscription.billedSeats))
  }, [subscription?.billedSeats])

  if (!me || me.role !== 'admin') return null

  if (isLoading || !subscription) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const checkoutResult = searchParams.get('checkout')

  async function handleCheckout(plan: PaidPlan) {
    const seats = Number(seatsForCheckout[plan] ?? '1')
    if (!Number.isInteger(seats) || seats < 1) return
    const { url } = await checkout.mutateAsync({ plan, seats })
    window.location.href = url
  }

  async function handlePortal() {
    const { url } = await portal.mutateAsync()
    window.location.href = url
  }

  function handleUpdateSeats() {
    const seats = Number(seatsInput)
    if (!Number.isInteger(seats) || seats < 1) return
    updateSeats.mutate(seats)
  }

  const isPaid = subscription.plan === 'standard' || subscription.plan === 'pro'

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">プラン・お支払い</h1>
        <p className="text-sm text-gray-500 mt-1">現在のプランの確認・変更、お支払い情報の管理ができます。</p>
      </div>

      {checkoutResult === 'success' && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          お支払いが完了しました。プランの反映まで少し時間がかかる場合があります。
        </div>
      )}

      {/* 現在の状態 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">現在のプラン</div>
            <div className="text-lg font-bold text-gray-900">
              {PLANS.find((p) => p.id === subscription.plan)?.name ?? subscription.plan}
            </div>
          </div>
          {subscription.status && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
              {STATUS_LABELS[subscription.status] ?? subscription.status}
            </span>
          )}
        </div>

        {subscription.currentPeriodEnd && (
          <div className="text-sm text-gray-500">
            次回更新日: {formatDate(subscription.currentPeriodEnd)}
          </div>
        )}

        {isPaid && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">契約人数</span>
            <input
              type="number"
              min={1}
              value={seatsInput}
              onChange={(e) => setSeatsInput(e.target.value)}
              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
            />
            <span className="text-sm text-gray-400">人</span>
            <button
              type="button"
              onClick={handleUpdateSeats}
              disabled={updateSeats.isPending || Number(seatsInput) === subscription.billedSeats}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
            >
              {updateSeats.isPending ? '更新中…' : '更新'}
            </button>
          </div>
        )}

        {subscription.hasStripeCustomer && (
          <button
            type="button"
            onClick={handlePortal}
            disabled={portal.isPending}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 pt-2"
          >
            <CreditCard className="h-4 w-4" />
            {portal.isPending ? '読み込み中…' : 'お支払い方法・請求書・解約の管理'}
          </button>
        )}
      </div>

      {/* プラン一覧 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === subscription.plan
          const isCheckoutable = plan.id === 'standard' || plan.id === 'pro'

          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 space-y-3 ${
                isCurrent ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">{plan.name}</span>
                {isCurrent && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    現在のプラン
                  </span>
                )}
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-400 ml-1">{plan.unit}</span>
              </div>
              <p className="text-sm text-gray-500">{plan.desc}</p>

              {isCheckoutable && !isCurrent && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min={1}
                    placeholder="人数"
                    value={seatsForCheckout[plan.id] ?? ''}
                    onChange={(e) =>
                      setSeatsForCheckout((prev) => ({ ...prev, [plan.id]: e.target.value }))
                    }
                    className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.id as PaidPlan)}
                    disabled={checkout.isPending}
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    このプランにする
                  </button>
                </div>
              )}

              {plan.id === 'enterprise' && !isCurrent && (
                <a
                  href="mailto:sales@example.com"
                  className="block text-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  お問い合わせ
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
