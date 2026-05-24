'use client'

import { ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useWorkTypes } from '@/hooks/use-clock'
import type { DayEntry, MonthSummary } from '@/hooks/use-history'
import { useHistory } from '@/hooks/use-history'
import type { WorkType } from '@/lib/api-client'

// ─── カラーマップ ─────────────────────────────────────────────────────────────

type ColorKey = 'slate' | 'green' | 'blue' | 'amber' | 'default'

const STYLE: Record<ColorKey, { dot: string; bar: string; badge: string }> = {
  slate: { dot: 'bg-slate-400', bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  green: { dot: 'bg-green-500', bar: 'bg-green-400', badge: 'bg-green-100 text-green-700' },
  blue: { dot: 'bg-blue-500', bar: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700' },
  amber: { dot: 'bg-amber-500', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
  default: { dot: 'bg-slate-400', bar: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600' },
}

function colorKey(hex: string): ColorKey {
  if (hex.startsWith('#64') || hex.startsWith('#94')) return 'slate'
  if (hex.startsWith('#22') || hex.startsWith('#16')) return 'green'
  if (hex.startsWith('#3b') || hex.startsWith('#60')) return 'blue'
  if (hex.startsWith('#f5') || hex.startsWith('#fb')) return 'amber'
  return 'default'
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function parseDateKey(dateKey: string): { month: number; day: number; weekday: string } {
  const d = new Date(`${dateKey}T00:00:00Z`)
  return {
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: WEEKDAYS[d.getUTCDay()],
  }
}

function isWeekend(dateKey: string): boolean {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

// ─── サブコンポーネント ────────────────────────────────────────────────────────

function MonthlySummaryCard({
  summary,
  workTypes,
}: {
  summary: MonthSummary
  workTypes: WorkType[]
}) {
  const wtMap = new Map(workTypes.map((w) => [w.id, w]))
  const maxMin = Math.max(...summary.workTypeBreakdown.map((b) => b.minutes), 1)

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-slate-800">月次サマリー</h2>
        <div className="text-right">
          <span className="text-2xl font-bold text-slate-800">{formatMin(summary.totalMin)}</span>
          {summary.breakMin > 0 && (
            <span className="text-sm text-slate-400 ml-2">休憩 {formatMin(summary.breakMin)}</span>
          )}
        </div>
      </div>

      {summary.workTypeBreakdown.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-2">打刻記録がありません</p>
      ) : (
        <div className="space-y-3">
          {summary.workTypeBreakdown.map(({ workTypeId, workTypeName, minutes }) => {
            const wt = wtMap.get(workTypeId)
            const ck = wt ? colorKey(wt.color) : 'default'
            const s = STYLE[ck]
            const pct = Math.round((minutes / maxMin) * 100)
            return (
              <div key={workTypeId}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                    <span className="text-sm font-semibold text-slate-700 truncate">
                      {workTypeName}
                    </span>
                    {wt?.isBillable && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${s.badge}`}
                      >
                        精算
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-800 tabular-nums ml-4 shrink-0">
                    {formatMin(minutes)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DayRow({ day, workTypes }: { day: DayEntry; workTypes: WorkType[] }) {
  const wtMap = new Map(workTypes.map((w) => [w.id, w]))
  const { month, day: d, weekday } = parseDateKey(day.dateKey)
  const weekend = isWeekend(day.dateKey)

  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-start gap-4">
        {/* 日付 */}
        <div className="w-14 shrink-0 text-center">
          <div
            className={`text-lg font-bold tabular-nums leading-none ${weekend ? 'text-red-500' : 'text-slate-800'}`}
          >
            {d}
          </div>
          <div
            className={`text-xs mt-0.5 font-medium ${weekend ? 'text-red-400' : 'text-slate-400'}`}
          >
            {month}/{d} ({weekday})
          </div>
        </div>

        {/* 打刻時刻 */}
        <div className="w-28 shrink-0">
          {day.clockInAt ? (
            <div className="flex items-center gap-1 text-sm">
              <span className="font-mono font-semibold text-slate-700">
                {formatTime(day.clockInAt)}
              </span>
              <span className="text-slate-300">→</span>
              <span className="font-mono font-semibold text-slate-700">
                {day.clockOutAt ? (
                  formatTime(day.clockOutAt)
                ) : (
                  <span className="text-green-600 animate-pulse">稼働中</span>
                )}
              </span>
            </div>
          ) : (
            <span className="text-sm text-slate-300">—</span>
          )}
        </div>

        {/* 合計稼働 + ワークタイプ内訳 */}
        <div className="flex-1 min-w-0">
          {day.totalMin > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800">{formatMin(day.totalMin)}</span>
              {day.workTypeBreakdown.map(({ workTypeId, workTypeName, minutes }) => {
                const wt = wtMap.get(workTypeId)
                const ck = wt ? colorKey(wt.color) : 'default'
                const s = STYLE[ck]
                return (
                  <span
                    key={workTypeId}
                    className="inline-flex items-center gap-1 text-xs font-medium"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    <span className="text-slate-500">{workTypeName}</span>
                    <span className="text-slate-400">{formatMin(minutes)}</span>
                  </span>
                )
              })}
            </div>
          )}
          {day.breakMin > 0 && (
            <div className="text-xs text-slate-400 mt-0.5">休憩 {formatMin(day.breakMin)}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function HistoryPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: wtData, isLoading: wtLoading } = useWorkTypes()
  const workTypes = wtData?.workTypes ?? []

  const { days, monthlySummary, isLoading: histLoading } = useHistory(year, month, workTypes)

  const isLoading = wtLoading || histLoading

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    if (isCurrentMonth) return
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Clock className="h-3.5 w-3.5" />
          <span>勤怠履歴</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 flex-1">勤怠履歴</h1>
          {/* 月ナビゲーション */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-base font-semibold text-slate-700 w-24 text-center tabular-nums">
              {year}年{month}月
            </span>
            <button
              type="button"
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* 月次サマリー */}
          <MonthlySummaryCard summary={monthlySummary} workTypes={workTypes} />

          {/* 日別一覧 */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-1">日別一覧</h2>
            <p className="text-xs text-slate-400 mb-4">出勤があった日のみ表示</p>

            {days.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                {year}年{month}月の打刻記録はありません
              </p>
            ) : (
              <div>
                {days.map((day) => (
                  <DayRow key={day.dateKey} day={day} workTypes={workTypes} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
