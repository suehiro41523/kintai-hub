'use client'

import * as HolidayJP from '@holiday-jp/holiday_jp'
import { ChevronLeft, ChevronRight, Layers, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  useBulkUpsertShifts,
  useCreateShiftPattern,
  useDeleteShift,
  useMyShifts,
  useShiftPatterns,
  useTeamShifts,
  useUpdateShiftPattern,
} from '@/hooks/useShifts'
import { useUsers } from '@/hooks/useUsers'
import type { Shift, ShiftPattern, User } from '@/lib/apiClient'

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function monthRange(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const lastDay = new Date(year, month, 0).getDate()
  return { firstDay, lastDay }
}

function formatTime(t: string | null): string {
  if (!t) return '—'
  return t.slice(0, 5)
}

function shiftLabel(s: Shift, patterns: ShiftPattern[]): string {
  if (s.shiftPatternId) {
    const p = patterns.find((p) => p.id === s.shiftPatternId)
    if (p) return p.name
  }
  return `${formatTime(s.startTime)}〜${formatTime(s.endTime)}`
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

type BulkMode = 'specific_date' | 'specific_dow' | 'weekdays_no_holiday' | 'weekdays_with_holiday'

function generateTargetDates(
  year: number,
  month: number,
  mode: BulkMode,
  specificDate: string,
  selectedDows: number[],
): string[] {
  if (mode === 'specific_date') return specificDate ? [specificDate] : []

  const lastDay = new Date(year, month, 0).getDate()
  const dates: string[] = []

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    const dateStr = toDateStr(year, month, d)

    if (mode === 'specific_dow') {
      if (selectedDows.includes(dow)) dates.push(dateStr)
    } else if (mode === 'weekdays_with_holiday') {
      if (dow >= 1 && dow <= 5) dates.push(dateStr)
    } else if (mode === 'weekdays_no_holiday') {
      if (dow >= 1 && dow <= 5 && !HolidayJP.isHoliday(date)) dates.push(dateStr)
    }
  }
  return dates
}

// ─── 月ナビゲーション ─────────────────────────────────────────────────────────

interface MonthNavProps {
  year: number
  month: number
  onPrev: () => void
  onNext: () => void
}

function MonthNav({ year, month, onPrev, onNext }: MonthNavProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <ChevronLeft className="h-4 w-4 text-gray-600" />
      </button>
      <span className="text-sm font-semibold text-gray-900 w-24 text-center">
        {year}年{month}月
      </span>
      <button
        type="button"
        onClick={onNext}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <ChevronRight className="h-4 w-4 text-gray-600" />
      </button>
    </div>
  )
}

// ─── シフトセルカラー ─────────────────────────────────────────────────────────

const CELL_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
]

function patternColor(patternId: string | null, patterns: ShiftPattern[]): string {
  if (!patternId) return 'bg-gray-100 text-gray-600 border-gray-200'
  const idx = patterns.findIndex((p) => p.id === patternId)
  return CELL_COLORS[idx % CELL_COLORS.length]
}

// ─── 一括登録モーダル ─────────────────────────────────────────────────────────

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

interface BulkRegisterModalProps {
  year: number
  month: number
  users: User[]
  patterns: ShiftPattern[]
  defaultTarget: 'single' | 'all'
  onClose: () => void
}

function BulkRegisterModal({
  year,
  month,
  users,
  patterns,
  defaultTarget,
  onClose,
}: BulkRegisterModalProps) {
  const upsertMut = useBulkUpsertShifts(year, month)

  const [targetType, setTargetType] = useState<'single' | 'all'>(defaultTarget)
  const [targetUserId, setTargetUserId] = useState(users[0]?.id ?? '')
  const [patternId, setPatternId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [mode, setMode] = useState<BulkMode>('weekdays_no_holiday')
  const [specificDate, setSpecificDate] = useState(toDateStr(year, month, 1))
  const [selectedDows, setSelectedDows] = useState<number[]>([1, 2, 3, 4, 5])
  const [error, setError] = useState<string | null>(null)

  function applyPattern(id: string) {
    setPatternId(id)
    const p = patterns.find((p) => p.id === id)
    if (p) {
      setStartTime(formatTime(p.startTime))
      setEndTime(formatTime(p.endTime))
    }
  }

  function toggleDow(d: number) {
    setSelectedDows((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  const targetDates = useMemo(
    () => generateTargetDates(year, month, mode, specificDate, selectedDows),
    [year, month, mode, specificDate, selectedDows],
  )

  const targetUsers = targetType === 'all' ? users : users.filter((u) => u.id === targetUserId)
  const totalCount = targetDates.length * targetUsers.length

  async function handleSubmit() {
    if (!startTime || !endTime) {
      setError('開始時刻と終了時刻は必須です')
      return
    }
    if (targetDates.length === 0) {
      setError('対象日が1件もありません')
      return
    }
    setError(null)
    const items = targetUsers.flatMap((u) =>
      targetDates.map((shiftDate) => ({
        userId: u.id,
        shiftDate,
        startTime,
        endTime,
        shiftPatternId: patternId || null,
      })),
    )
    try {
      await upsertMut.mutateAsync(items)
      onClose()
    } catch {
      setError('登録に失敗しました')
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">一括シフト登録</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 対象 */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">対象</p>
            <div className="flex gap-3">
              {(['single', 'all'] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value={t}
                    checked={targetType === t}
                    onChange={() => setTargetType(t)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    {t === 'single' ? '特定のユーザー' : '全員'}
                  </span>
                </label>
              ))}
            </div>
            {targetType === 'single' && (
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* シフトパターン・時刻 */}
          <div>
            <label htmlFor="br-pattern" className="block text-xs font-medium text-gray-700 mb-1">
              シフトパターン（任意）
            </label>
            <select
              id="br-pattern"
              value={patternId}
              onChange={(e) => applyPattern(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">パターン指定なし</option>
              {patterns
                .filter((p) => p.isActive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{formatTime(p.startTime)}〜{formatTime(p.endTime)}）
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="br-start" className="block text-xs font-medium text-gray-700 mb-1">
                開始時刻
              </label>
              <input
                id="br-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="br-end" className="block text-xs font-medium text-gray-700 mb-1">
                終了時刻
              </label>
              <input
                id="br-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 登録範囲 */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">登録範囲</p>
            <div className="space-y-2">
              {(
                [
                  { value: 'specific_date', label: '特定の日' },
                  { value: 'specific_dow', label: '特定の曜日' },
                  { value: 'weekdays_no_holiday', label: '平日（祝日除く）' },
                  { value: 'weekdays_with_holiday', label: '平日（祝日含む）' },
                ] as { value: BulkMode; label: string }[]
              ).map(({ value, label }) => (
                <label key={value} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bulkMode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="accent-blue-600 mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-700">{label}</span>
                    {mode === value && value === 'specific_date' && (
                      <input
                        type="date"
                        value={specificDate}
                        onChange={(e) => setSpecificDate(e.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    {mode === value && value === 'specific_dow' && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {DOW_LABELS.map((label, d) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleDow(d)}
                            className={`h-7 w-7 rounded-full text-xs font-medium transition-colors ${
                              selectedDows.includes(d)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } ${d === 0 ? 'text-red-500 data-[active]:bg-red-600' : d === 6 ? 'text-blue-500 data-[active]:bg-blue-600' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700">
            {targetDates.length === 0 ? (
              <span className="text-gray-400">対象日が選択されていません</span>
            ) : (
              <span>
                {year}年{month}月の <strong>{targetDates.length}日</strong> に対して{' '}
                <strong>{targetUsers.length}名</strong> 分、計 <strong>{totalCount}件</strong>{' '}
                を登録します
              </span>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={upsertMut.isPending || totalCount === 0}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {upsertMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                `${totalCount}件を一括登録`
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 自分のシフト (月次カレンダー) ───────────────────────────────────────────

const DOW = ['日', '月', '火', '水', '木', '金', '土']

interface MyShiftsTabProps {
  year: number
  month: number
}

function MyShiftsTab({ year, month }: MyShiftsTabProps) {
  const { data: shifts = [], isLoading } = useMyShifts(year, month)
  const { data: patterns = [] } = useShiftPatterns()
  const { data: users = [] } = useUsers()
  const { firstDay, lastDay } = monthRange(year, month)
  const [showBulk, setShowBulk] = useState(false)

  const shiftByDate = new Map<string, Shift>()
  for (const s of shifts) {
    shiftByDate.set(s.shiftDate, s)
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ]
  const trailing = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < trailing; i++) cells.push(null)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setShowBulk(true)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 rounded-lg px-3 py-1.5 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <Layers className="h-4 w-4" />
          一括登録
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DOW.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const dateStr = day ? toDateStr(year, month, day) : ''
            const shift = day ? shiftByDate.get(dateStr) : undefined
            const isToday =
              day !== null &&
              dateStr === new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
            const col = idx % 7

            return (
              <div
                key={day !== null ? `cell-${day}` : `empty-${idx}`}
                className={`min-h-[72px] p-1.5 border-b border-r border-gray-50 ${day === null ? 'bg-gray-50/50' : ''}`}
              >
                {day !== null && (
                  <>
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium mb-1 ${
                        isToday
                          ? 'bg-blue-600 text-white'
                          : col === 0
                            ? 'text-red-500'
                            : col === 6
                              ? 'text-blue-500'
                              : 'text-gray-700'
                      }`}
                    >
                      {day}
                    </span>
                    {shift && (
                      <div
                        className={`rounded px-1 py-0.5 text-xs font-medium border leading-tight ${patternColor(shift.shiftPatternId, patterns)}`}
                      >
                        <div className="truncate">{shiftLabel(shift, patterns)}</div>
                        <div className="opacity-75">
                          {formatTime(shift.startTime)}〜{formatTime(shift.endTime)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {showBulk && (
        <BulkRegisterModal
          year={year}
          month={month}
          users={users}
          patterns={patterns}
          defaultTarget="single"
          onClose={() => setShowBulk(false)}
        />
      )}
    </>
  )
}

// ─── シフト割り当てモーダル ───────────────────────────────────────────────────

interface AssignModalProps {
  year: number
  month: number
  users: User[]
  patterns: ShiftPattern[]
  initial?: { userId: string; day: number; shift?: Shift }
  onClose: () => void
}

function AssignModal({ year, month, users, patterns, initial, onClose }: AssignModalProps) {
  const upsertMut = useBulkUpsertShifts(year, month)
  const deleteMut = useDeleteShift(year, month)

  const [userId, setUserId] = useState(initial?.userId ?? users[0]?.id ?? '')
  const [day, setDay] = useState(initial?.day ?? 1)
  const [patternId, setPatternId] = useState(initial?.shift?.shiftPatternId ?? '')
  const [startTime, setStartTime] = useState(
    initial?.shift?.startTime ? formatTime(initial.shift.startTime) : '',
  )
  const [endTime, setEndTime] = useState(
    initial?.shift?.endTime ? formatTime(initial.shift.endTime) : '',
  )
  const [error, setError] = useState<string | null>(null)

  const { lastDay } = monthRange(year, month)

  function applyPattern(id: string) {
    setPatternId(id)
    const p = patterns.find((p) => p.id === id)
    if (p) {
      setStartTime(formatTime(p.startTime))
      setEndTime(formatTime(p.endTime))
    }
  }

  async function handleSave() {
    if (!userId || !startTime || !endTime) {
      setError('担当者・開始時刻・終了時刻は必須です')
      return
    }
    setError(null)
    try {
      await upsertMut.mutateAsync([
        {
          userId,
          shiftDate: toDateStr(year, month, day),
          startTime,
          endTime,
          shiftPatternId: patternId || null,
        },
      ])
      onClose()
    } catch {
      setError('保存に失敗しました')
    }
  }

  async function handleDelete() {
    if (!initial?.shift) return
    try {
      await deleteMut.mutateAsync(initial.shift.id)
      onClose()
    } catch {
      setError('削除に失敗しました')
    }
  }

  const isPending = upsertMut.isPending || deleteMut.isPending

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">シフトを割り当て</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="am-user" className="block text-xs font-medium text-gray-700 mb-1">
                担当者
              </label>
              <select
                id="am-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={!!initial}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="am-day" className="block text-xs font-medium text-gray-700 mb-1">
                日付
              </label>
              <select
                id="am-day"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                disabled={!!initial}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                {Array.from({ length: lastDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="am-pattern" className="block text-xs font-medium text-gray-700 mb-1">
              シフトパターン（任意）
            </label>
            <select
              id="am-pattern"
              value={patternId}
              onChange={(e) => applyPattern(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">パターンを選択…</option>
              {patterns
                .filter((p) => p.isActive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{formatTime(p.startTime)}〜{formatTime(p.endTime)}）
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="am-start" className="block text-xs font-medium text-gray-700 mb-1">
                開始時刻
              </label>
              <input
                id="am-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="am-end" className="block text-xs font-medium text-gray-700 mb-1">
                終了時刻
              </label>
              <input
                id="am-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : '保存'}
            </button>
            {initial?.shift && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── チームシフト (ロスター表) ────────────────────────────────────────────────

interface TeamShiftsTabProps {
  year: number
  month: number
}

function TeamShiftsTab({ year, month }: TeamShiftsTabProps) {
  const { data: shifts = [], isLoading: shiftsLoading } = useTeamShifts(year, month)
  const { data: patterns = [] } = useShiftPatterns()
  const { data: users = [], isLoading: usersLoading } = useUsers()
  const [modal, setModal] = useState<{ userId: string; day: number; shift?: Shift } | null>(null)
  const [showBulk, setShowBulk] = useState(false)

  const { lastDay } = monthRange(year, month)
  const days = Array.from({ length: lastDay }, (_, i) => i + 1)

  const shiftMap = new Map<string, Shift>()
  for (const s of shifts) {
    shiftMap.set(`${s.userId}:${s.shiftDate}`, s)
  }

  const isLoading = shiftsLoading || usersLoading

  return (
    <>
      <div className="flex justify-end gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowBulk(true)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 rounded-lg px-3 py-1.5 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <Layers className="h-4 w-4" />
          一括登録
        </button>
        <button
          type="button"
          onClick={() => setModal({ userId: users[0]?.id ?? '', day: 1 })}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          シフトを追加
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">従業員が登録されていません</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-medium text-gray-600 border-r border-gray-200 min-w-[96px]">
                    従業員
                  </th>
                  {days.map((d) => {
                    const dow = new Date(year, month - 1, d).getDay()
                    return (
                      <th
                        key={d}
                        className={`px-1 py-2 text-center font-medium min-w-[52px] ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-600'}`}
                      >
                        <div>{d}</div>
                        <div className="font-normal text-gray-400">{DOW[dow]}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="sticky left-0 bg-white z-10 px-3 py-1.5 border-r border-gray-200">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <span className="text-gray-800 font-medium truncate max-w-[60px]">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    {days.map((d) => {
                      const dateStr = toDateStr(year, month, d)
                      const shift = shiftMap.get(`${user.id}:${dateStr}`)
                      const dow = new Date(year, month - 1, d).getDay()
                      return (
                        <td
                          key={d}
                          className={`p-0.5 align-top cursor-pointer hover:bg-blue-50 transition-colors ${dow === 0 || dow === 6 ? 'bg-gray-50/60' : ''}`}
                          onClick={() => setModal({ userId: user.id, day: d, shift })}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && setModal({ userId: user.id, day: d, shift })
                          }
                        >
                          {shift ? (
                            <div
                              className={`rounded px-1 py-0.5 leading-tight border ${patternColor(shift.shiftPatternId, patterns)}`}
                            >
                              <div className="font-medium truncate max-w-[48px]">
                                {shiftLabel(shift, patterns)}
                              </div>
                            </div>
                          ) : (
                            <div className="h-8" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <AssignModal
          year={year}
          month={month}
          users={users}
          patterns={patterns}
          initial={modal}
          onClose={() => setModal(null)}
        />
      )}
      {showBulk && (
        <BulkRegisterModal
          year={year}
          month={month}
          users={users}
          patterns={patterns}
          defaultTarget="all"
          onClose={() => setShowBulk(false)}
        />
      )}
    </>
  )
}

// ─── シフトパターン管理 ───────────────────────────────────────────────────────

interface PatternFormState {
  id: string | null
  name: string
  startTime: string
  endTime: string
  breakMinutes: string
}

function emptyPatternForm(): PatternFormState {
  return { id: null, name: '', startTime: '', endTime: '', breakMinutes: '60' }
}

function patternToForm(p: ShiftPattern): PatternFormState {
  return {
    id: p.id,
    name: p.name,
    startTime: formatTime(p.startTime),
    endTime: formatTime(p.endTime),
    breakMinutes: String(p.breakMinutes),
  }
}

function ShiftPatternsTab() {
  const { data: patterns = [], isLoading } = useShiftPatterns()
  const createMut = useCreateShiftPattern()
  const updateMut = useUpdateShiftPattern()

  const [form, setForm] = useState<PatternFormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const set = (patch: Partial<PatternFormState>) => setForm((f) => (f ? { ...f, ...patch } : f))

  async function handleSubmit() {
    if (!form) return
    if (!form.name.trim() || !form.startTime || !form.endTime) {
      setFormError('名前・開始時刻・終了時刻は必須です')
      return
    }
    setFormError(null)
    const payload = {
      name: form.name.trim(),
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes) || 0,
    }
    try {
      if (form.id) {
        await updateMut.mutateAsync({ id: form.id, data: payload })
      } else {
        await createMut.mutateAsync(payload)
      }
      setForm(null)
    } catch {
      setFormError('保存に失敗しました')
    }
  }

  async function handleDeactivate(p: ShiftPattern) {
    await updateMut.mutateAsync({ id: p.id, data: { isActive: !p.isActive } })
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => {
            setFormError(null)
            setForm(emptyPatternForm())
          }}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          パターンを追加
        </button>
      </div>

      {form && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {form.id ? 'パターンを編集' : 'パターンを追加'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label htmlFor="pf-name" className="block text-xs font-medium text-gray-700 mb-1">
                名前
              </label>
              <input
                id="pf-name"
                type="text"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="日勤・夜勤 など"
              />
            </div>
            <div>
              <label htmlFor="pf-start" className="block text-xs font-medium text-gray-700 mb-1">
                開始時刻
              </label>
              <input
                id="pf-start"
                type="time"
                value={form.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="pf-end" className="block text-xs font-medium text-gray-700 mb-1">
                終了時刻
              </label>
              <input
                id="pf-end"
                type="time"
                value={form.endTime}
                onChange={(e) => set({ endTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="pf-break" className="block text-xs font-medium text-gray-700 mb-1">
                休憩時間（分）
              </label>
              <input
                id="pf-break"
                type="number"
                value={form.breakMinutes}
                onChange={(e) => set({ breakMinutes: e.target.value })}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="60"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600 mt-2">{formError}</p>}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : '保存'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : patterns.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          シフトパターンが登録されていません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {patterns.map((p, idx) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${CELL_COLORS[idx % CELL_COLORS.length]}`}
              >
                {p.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{p.name}</span>
                  {!p.isActive && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                      無効
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {formatTime(p.startTime)}〜{formatTime(p.endTime)}・休憩 {p.breakMinutes}分
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null)
                    setForm(patternToForm(p))
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  aria-label="編集"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeactivate(p)}
                  disabled={updateMut.isPending}
                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${p.isActive ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                  aria-label={p.isActive ? '無効化' : '有効化'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── ページ ──────────────────────────────────────────────────────────────────

type Tab = 'my' | 'team' | 'patterns'

export default function ShiftsPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [tab, setTab] = useState<Tab>('my')

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else setMonth((m) => m + 1)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'my', label: '自分のシフト' },
    { key: 'team', label: 'チームシフト' },
    { key: 'patterns', label: 'シフトパターン' },
  ]

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">シフト</h1>
        {tab !== 'patterns' && (
          <MonthNav year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
        )}
      </div>

      <div className="flex border-b border-gray-200">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'my' && <MyShiftsTab year={year} month={month} />}
      {tab === 'team' && <TeamShiftsTab year={year} month={month} />}
      {tab === 'patterns' && <ShiftPatternsTab />}
    </div>
  )
}
