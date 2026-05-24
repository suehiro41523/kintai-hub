'use client'

import { ChevronLeft, ChevronRight, Clock, DollarSign, Loader2, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useMonthlyReport } from '@/hooks/useReports'
import type { BillingBreakdown, WorkTypeHours } from '@/lib/apiClient'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<BillingBreakdown['status'], string> = {
  uncalculated: '未計算',
  draft: '下書き',
  confirmed: '確定済',
}

const STATUS_BADGE: Record<BillingBreakdown['status'], string> = {
  uncalculated: 'bg-gray-100 text-gray-500',
  draft: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
}

const BILLING_TYPE_LABEL: Record<string, string> = {
  fixed: '固定',
  hourly: '時間精算',
  range: '上下幅あり',
  project: 'プロジェクト',
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function formatHours(h: number): string {
  const int = Math.floor(h)
  const min = Math.round((h - int) * 60)
  if (min === 0) return `${int}h`
  return `${int}h ${min}m`
}

function formatAmount(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}

// ─── サマリーカード ───────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: string
}

function SummaryCard({ icon, label, value, sub, accent = 'text-gray-900' }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className="p-2 bg-gray-50 rounded-lg flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${accent}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── ワークタイプ別内訳 ────────────────────────────────────────────────────────

function WorkTypeBreakdownSection({ items }: { items: WorkTypeHours[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">この月の稼働記録がありません</div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.workTypeId} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium text-gray-800 truncate">{item.workTypeName}</span>
              {item.isBillable && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded flex-shrink-0">
                  請求対象
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              <span className="text-xs text-gray-400">{item.percentage}%</span>
              <span className="font-semibold text-gray-900 w-16 text-right">
                {formatHours(item.hours)}
              </span>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 契約別精算内訳 ───────────────────────────────────────────────────────────

function BillingBreakdownSection({ items }: { items: BillingBreakdown[] }) {
  if (items.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm">登録された契約がありません</div>
  }

  const totalBilling = items.reduce((sum, i) => sum + (i.billingAmount ?? 0), 0)

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.contractId} className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{item.clientName}</span>
                <span className="text-xs text-gray-400">
                  {BILLING_TYPE_LABEL[item.billingType] ?? item.billingType}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{item.workTypeName}</p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[item.status]}`}
            >
              {STATUS_LABEL[item.status]}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-gray-400">実稼働</p>
              <p className="font-medium text-gray-800 mt-0.5">{formatHours(item.actualHours)}</p>
            </div>
            <div>
              <p className="text-gray-400">精算時間</p>
              <p className="font-medium text-gray-800 mt-0.5">
                {item.billingHours !== null ? formatHours(item.billingHours) : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">請求金額</p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {item.billingAmount !== null ? formatAmount(item.billingAmount) : '—'}
              </p>
            </div>
          </div>
        </div>
      ))}

      {items.some((i) => i.billingAmount !== null) && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <span className="text-sm text-gray-600">請求合計</span>
          <span className="text-base font-bold text-gray-900">{formatAmount(totalBilling)}</span>
        </div>
      )}
    </div>
  )
}

// ─── ページ ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: report, isLoading } = useMonthlyReport(year, month)

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const isCurrentOrFuture = year > currentYear || (year === currentYear && month >= currentMonth)

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (isCurrentOrFuture) return
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">レポート</h1>

      {/* 月選択 */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="前月"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold text-gray-900 w-28 text-center">
          {year}年{month}月
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={isCurrentOrFuture}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="次月"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : report ? (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              icon={<Clock className="h-4 w-4 text-blue-500" />}
              label="総稼働時間"
              value={formatHours(report.totalHours)}
              sub={`うち請求対象 ${formatHours(report.billableHours)}`}
            />
            <SummaryCard
              icon={<TrendingUp className="h-4 w-4 text-green-500" />}
              label="非請求時間"
              value={formatHours(report.nonBillableHours)}
              sub={
                report.totalHours > 0
                  ? `全体の ${Math.round((report.nonBillableHours / report.totalHours) * 100)}%`
                  : undefined
              }
            />
            <div className="col-span-2">
              <SummaryCard
                icon={<DollarSign className="h-4 w-4 text-amber-500" />}
                label="請求合計（確定分）"
                value={formatAmount(
                  report.billingBreakdown
                    .filter((b) => b.status === 'confirmed' && b.billingAmount !== null)
                    .reduce((sum, b) => sum + (b.billingAmount ?? 0), 0),
                )}
                sub={
                  report.billingBreakdown.some(
                    (b) => b.status === 'draft' && b.billingAmount !== null,
                  )
                    ? `下書き含む合計 ${formatAmount(report.billingBreakdown.filter((b) => b.billingAmount !== null).reduce((sum, b) => sum + (b.billingAmount ?? 0), 0))}`
                    : undefined
                }
                accent="text-amber-700"
              />
            </div>
          </div>

          {/* ワークタイプ別内訳 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">ワークタイプ別稼働</h2>
            <WorkTypeBreakdownSection items={report.workTypeBreakdown} />
          </div>

          {/* 契約別精算内訳 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">契約別精算内訳</h2>
            <BillingBreakdownSection items={report.billingBreakdown} />
          </div>
        </>
      ) : null}
    </div>
  )
}
