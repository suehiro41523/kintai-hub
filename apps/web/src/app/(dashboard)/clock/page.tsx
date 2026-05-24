'use client'

import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Clock,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  User,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  useBreakEnd,
  useBreakStart,
  useClockIn,
  useClockOut,
  useSwitchType,
  useTodayRecords,
  useWorkTypes,
} from '@/hooks/useClock'
import type { RecordType, WorkType } from '@/lib/apiClient'
import { ApiError } from '@/lib/apiClient'

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const MOCK_USER = { name: '田中太郎', department: '開発部', employeeCode: 'EMP-0042' }

// ─── スタイルマップ（color hex → Tailwind クラス） ────────────────────────────
// Tailwind の動的クラスは purge されるため静的マッピングが必要

type ColorKey = 'slate' | 'green' | 'blue' | 'amber' | 'default'

const STYLE: Record<
  ColorKey,
  { card: string; selected: string; badge: string; bar: string; dot: string }
> = {
  slate: {
    card: 'border-slate-200 hover:border-slate-400 hover:bg-slate-50',
    selected: 'border-slate-500 bg-slate-50 ring-2 ring-slate-400 ring-offset-1',
    badge: 'bg-slate-100 text-slate-600',
    bar: 'bg-slate-400',
    dot: 'bg-slate-400',
  },
  green: {
    card: 'border-green-200 hover:border-green-400 hover:bg-green-50',
    selected: 'border-green-500 bg-green-50 ring-2 ring-green-400 ring-offset-1',
    badge: 'bg-green-100 text-green-700',
    bar: 'bg-green-400',
    dot: 'bg-green-500',
  },
  blue: {
    card: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',
    selected: 'border-blue-500 bg-blue-50 ring-2 ring-blue-400 ring-offset-1',
    badge: 'bg-blue-100 text-blue-700',
    bar: 'bg-blue-400',
    dot: 'bg-blue-500',
  },
  amber: {
    card: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50',
    selected: 'border-amber-500 bg-amber-50 ring-2 ring-amber-400 ring-offset-1',
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-400',
    dot: 'bg-amber-500',
  },
  default: {
    card: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
    selected: 'border-slate-400 bg-slate-50 ring-2 ring-slate-300 ring-offset-1',
    badge: 'bg-slate-100 text-slate-600',
    bar: 'bg-slate-300',
    dot: 'bg-slate-400',
  },
}

function colorKey(hex: string): ColorKey {
  if (hex.startsWith('#64') || hex.startsWith('#94')) return 'slate'
  if (hex.startsWith('#22') || hex.startsWith('#16')) return 'green'
  if (hex.startsWith('#3b') || hex.startsWith('#60')) return 'blue'
  if (hex.startsWith('#f5') || hex.startsWith('#fb')) return 'amber'
  return 'default'
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function formatClock(d: Date) {
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDate(d: Date) {
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

const RECORD_LABEL: Record<RecordType, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function ClockPage() {
  // ── リアルタイム時計 ──
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── UI ローカル状態 ──
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string | null>(null)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; success: boolean } | null>(
    null,
  )

  // ── API データ ──
  const { data: wtData, isLoading: wtLoading } = useWorkTypes()
  const { data: todayData, isLoading: todayLoading } = useTodayRecords()

  // ── ミューテーション ──
  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const breakStart = useBreakStart()
  const breakEnd = useBreakEnd()
  const switchType = useSwitchType()

  const isMutating =
    clockIn.isPending ||
    clockOut.isPending ||
    breakStart.isPending ||
    breakEnd.isPending ||
    switchType.isPending

  // ── 通知自動消去 ──
  useEffect(() => {
    if (!notification) return
    const t = setTimeout(() => setNotification(null), 3500)
    return () => clearTimeout(t)
  }, [notification])

  // ── ミューテーションエラーを通知に反映 ──
  useEffect(() => {
    const err =
      clockIn.error ?? clockOut.error ?? breakStart.error ?? breakEnd.error ?? switchType.error
    if (!err) return
    const msg = err instanceof ApiError ? err.message : 'エラーが発生しました'
    setNotification({ message: msg, success: false })
  }, [clockIn.error, clockOut.error, breakStart.error, breakEnd.error, switchType.error])

  // ── 派生値 ──
  const workTypes = wtData?.workTypes ?? []
  const records = todayData?.records ?? []
  const summary = todayData?.summary
  const activeSession = todayData?.activeSession ?? null

  const status: 'idle' | 'working' | 'on_break' = !activeSession
    ? 'idle'
    : activeSession.isOnBreak
      ? 'on_break'
      : 'working'

  const currentWorkType = workTypes.find((w) => w.id === activeSession?.workTypeId) ?? null

  const workElapsedMs =
    activeSession && now
      ? (() => {
          const start =
            activeSession.isOnBreak && activeSession.breakStartedAt
              ? new Date(activeSession.breakStartedAt)
              : new Date(activeSession.clockedInAt)
          return now.getTime() - start.getTime()
        })()
      : 0

  const breakElapsedMs =
    activeSession?.isOnBreak && activeSession.breakStartedAt && now
      ? now.getTime() - new Date(activeSession.breakStartedAt).getTime()
      : 0

  // ── アクションハンドラ ──
  function notify(message: string) {
    setNotification({ message, success: true })
  }

  function handleClockIn() {
    if (!selectedWorkTypeId) return
    const wt = workTypes.find((w) => w.id === selectedWorkTypeId)
    clockIn.mutate(selectedWorkTypeId, {
      onSuccess: () => {
        notify(`${wt?.name ?? ''}で出勤しました`)
        setSelectedWorkTypeId(null)
      },
    })
  }

  function handleClockOut() {
    if (!activeSession) return
    const wt = workTypes.find((w) => w.id === activeSession.workTypeId)
    clockOut.mutate(activeSession.workTypeId, {
      onSuccess: () => notify(`退勤しました（${wt?.name ?? ''}）`),
    })
  }

  function handleBreakStart() {
    if (!activeSession) return
    breakStart.mutate(activeSession.workTypeId, {
      onSuccess: () => notify('休憩を開始しました'),
    })
  }

  function handleBreakEnd() {
    if (!activeSession) return
    breakEnd.mutate(activeSession.workTypeId, {
      onSuccess: () => notify('休憩を終了しました'),
    })
  }

  function handleSwitchType() {
    if (!activeSession || !switchTargetId) return
    const fromWt = workTypes.find((w) => w.id === activeSession.workTypeId)
    const toWt = workTypes.find((w) => w.id === switchTargetId)
    switchType.mutate(
      { from: activeSession.workTypeId, to: switchTargetId },
      {
        onSuccess: () => {
          notify(`${fromWt?.name ?? ''} → ${toWt?.name ?? ''} に切替えました`)
          setShowSwitcher(false)
          setSwitchTargetId(null)
        },
      },
    )
  }

  const isLoading = wtLoading || todayLoading

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* 通知トースト */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-sm font-semibold ${notification.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {notification.success ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {notification.message}
        </div>
      )}

      {/* ページヘッダー */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <User className="h-3.5 w-3.5" />
          <span>{MOCK_USER.name}</span>
          <span className="text-slate-300">·</span>
          <Building2 className="h-3.5 w-3.5" />
          <span>{MOCK_USER.department}</span>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-xs">{MOCK_USER.employeeCode}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">打刻</h1>
        <p className="text-slate-500 text-sm mt-0.5">{now ? formatDate(now) : ''}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── 時計カード ───────────────────────────────────────────────── */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2 text-slate-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm">現在時刻</span>
            </div>
            <div className="text-5xl font-mono font-bold text-slate-800 tracking-tight tabular-nums">
              {now ? formatClock(now) : '--:--:--'}
            </div>

            {/* ステータスバッジ */}
            <div className="mt-4 flex justify-center">
              {status === 'idle' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  未出勤
                </span>
              )}
              {status === 'working' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  勤務中 &mdash; {currentWorkType?.name}
                </span>
              )}
              {status === 'on_break' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  休憩中
                </span>
              )}
            </div>

            {/* 経過時間 */}
            {status !== 'idle' && (
              <div className="mt-2 text-sm text-slate-500">
                {status === 'working' ? (
                  <>
                    本日の勤務経過:{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {formatElapsed(workElapsedMs)}
                    </span>
                  </>
                ) : (
                  <>
                    休憩経過:{' '}
                    <span className="font-mono font-semibold text-amber-600">
                      {formatElapsed(breakElapsedMs)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── ワークタイプ選択（未出勤 or 切替時） ────────────────────── */}
          {(status === 'idle' || showSwitcher) && (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                {showSwitcher ? '切替先のワークタイプを選択' : 'ワークタイプを選択'}
              </h2>
              <WorkTypeGrid
                workTypes={workTypes}
                currentWorkTypeId={showSwitcher ? activeSession?.workTypeId : undefined}
                selectedId={showSwitcher ? switchTargetId : selectedWorkTypeId}
                onSelect={(id) => {
                  if (showSwitcher) setSwitchTargetId(id)
                  else setSelectedWorkTypeId((prev) => (prev === id ? null : id))
                }}
              />
            </div>
          )}

          {/* ── アクションボタン ─────────────────────────────────────────── */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            {/* 未出勤 → 出勤 */}
            {status === 'idle' && !showSwitcher && (
              <button
                type="button"
                onClick={handleClockIn}
                disabled={!selectedWorkTypeId || isMutating}
                className="w-full rounded-xl bg-blue-600 py-4 text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {clockIn.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogIn className="h-5 w-5" />
                )}
                出勤する
              </button>
            )}

            {/* 勤務中 → 退勤・休憩・切替 */}
            {status === 'working' && !showSwitcher && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClockOut}
                    disabled={isMutating}
                    className="flex-1 rounded-xl bg-slate-800 py-4 text-white font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    {clockOut.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <LogOut className="h-5 w-5" />
                    )}
                    退勤する
                  </button>
                  <button
                    type="button"
                    onClick={handleBreakStart}
                    disabled={isMutating}
                    className="flex-1 rounded-xl border-2 border-amber-300 bg-amber-50 py-4 text-amber-700 font-bold hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {breakStart.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Coffee className="h-5 w-5" />
                    )}
                    休憩開始
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSwitcher(true)
                    setSwitchTargetId(null)
                  }}
                  disabled={isMutating}
                  className="w-full rounded-xl border-2 border-slate-200 py-3 text-slate-600 font-semibold hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  ワークタイプを切替
                </button>
              </div>
            )}

            {/* 休憩中 → 休憩終了 */}
            {status === 'on_break' && !showSwitcher && (
              <button
                type="button"
                onClick={handleBreakEnd}
                disabled={isMutating}
                className="w-full rounded-xl bg-amber-500 py-4 text-white font-bold text-lg hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {breakEnd.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Coffee className="h-5 w-5" />
                )}
                休憩を終了する
              </button>
            )}

            {/* 切替モード */}
            {showSwitcher && (
              <div className="space-y-3">
                {currentWorkType && (
                  <p className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: currentWorkType.color }}
                    />
                    現在: {currentWorkType.name}
                    <ArrowLeftRight className="h-3.5 w-3.5 mx-0.5" />
                    <span className="font-semibold text-slate-700">
                      {switchTargetId
                        ? workTypes.find((w) => w.id === switchTargetId)?.name
                        : '選択してください'}
                    </span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSwitchType}
                  disabled={!switchTargetId || isMutating}
                  className="w-full rounded-xl bg-blue-600 py-4 text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {switchType.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowLeftRight className="h-5 w-5" />
                  )}
                  切替を実行する
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSwitcher(false)
                    setSwitchTargetId(null)
                  }}
                  className="w-full rounded-xl border-2 border-slate-200 py-3 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>

          {/* ── 本日の稼働サマリ ─────────────────────────────────────────── */}
          {summary && summary.workTypeBreakdown.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800">本日の稼働サマリ</h2>
                <span className="text-sm text-slate-500">
                  合計{' '}
                  <span className="font-bold text-slate-800 text-base">
                    {formatMinutes(summary.totalMin)}
                  </span>
                  {summary.breakMin > 0 && (
                    <span className="text-slate-400 ml-1">
                      （休憩 {formatMinutes(summary.breakMin)}）
                    </span>
                  )}
                </span>
              </div>
              <DaySummaryBars
                breakdown={summary.workTypeBreakdown}
                workTypes={workTypes}
                activeWorkTypeId={status !== 'idle' ? activeSession?.workTypeId : undefined}
              />
              {summary.workTypeBreakdown.some((b) => {
                const wt = workTypes.find((w) => w.id === b.workTypeId)
                return wt?.isBillable
              }) && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-sm">
                  <span className="text-slate-500">精算対象合計</span>
                  <span className="font-bold text-slate-800">
                    {formatMinutes(
                      summary.workTypeBreakdown
                        .filter((b) => workTypes.find((w) => w.id === b.workTypeId)?.isBillable)
                        .reduce((s, b) => s + b.minutes, 0),
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── 打刻ログ ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-3">本日の打刻ログ</h2>
            {records.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">打刻記録がありません</p>
            ) : (
              <div className="space-y-0.5">
                {[...records]
                  .sort((a, b) => a.clockedAt.localeCompare(b.clockedAt))
                  .map((r) => {
                    const wt = workTypes.find((w) => w.id === r.workTypeId)
                    const ck = wt ? colorKey(wt.color) : 'default'
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 py-2 text-sm border-b border-slate-50 last:border-0"
                      >
                        <span className={`h-2 w-2 rounded-full shrink-0 ${STYLE[ck].dot}`} />
                        <span className="font-mono text-slate-500 tabular-nums w-12 shrink-0">
                          {new Date(r.clockedAt).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </span>
                        <span className="font-semibold text-slate-700 w-16 shrink-0">
                          {RECORD_LABEL[r.recordType]}
                        </span>
                        <span className="text-slate-500 truncate">{wt?.name ?? '—'}</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── サブコンポーネント ────────────────────────────────────────────────────────

function WorkTypeGrid({
  workTypes,
  currentWorkTypeId,
  selectedId,
  onSelect,
}: {
  workTypes: WorkType[]
  currentWorkTypeId?: string
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {workTypes.map((wt) => {
        const ck = colorKey(wt.color)
        const s = STYLE[ck]
        const isCurrent = wt.id === currentWorkTypeId
        const isSelected = wt.id === selectedId
        return (
          <button
            key={wt.id}
            type="button"
            disabled={isCurrent}
            onClick={() => onSelect(wt.id)}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              isCurrent
                ? 'border-slate-200 opacity-40 cursor-not-allowed'
                : isSelected
                  ? s.selected
                  : `border-slate-200 ${s.card} cursor-pointer`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              {isCurrent && <span className="text-xs text-slate-400 font-medium">現在</span>}
              {isSelected && !isCurrent && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
            </div>
            <div className="font-semibold text-slate-800 text-sm leading-snug">{wt.name}</div>
            <div className="mt-1.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.badge}`}>
                {wt.isBillable ? '精算対象' : '社内原価'}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function DaySummaryBars({
  breakdown,
  workTypes,
  activeWorkTypeId,
}: {
  breakdown: { workTypeId: string; workTypeName: string; minutes: number }[]
  workTypes: WorkType[]
  activeWorkTypeId?: string
}) {
  const maxMin = Math.max(...breakdown.map((b) => b.minutes), 1)
  return (
    <div className="space-y-4">
      {breakdown.map(({ workTypeId, workTypeName, minutes }) => {
        const wt = workTypes.find((w) => w.id === workTypeId)
        const ck = wt ? colorKey(wt.color) : 'default'
        const s = STYLE[ck]
        const pct = Math.round((minutes / maxMin) * 100)
        return (
          <div key={workTypeId}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.dot}`} />
                <span className="text-sm font-semibold text-slate-700">{workTypeName}</span>
                {wt?.isBillable && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.badge}`}>
                    精算
                  </span>
                )}
                {activeWorkTypeId === workTypeId && (
                  <span className="text-xs text-green-600 font-semibold animate-pulse">
                    ● 稼働中
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                {formatMinutes(minutes)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
