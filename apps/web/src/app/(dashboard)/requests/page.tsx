'use client'

import { CheckCircle, Clock, Loader2, Plus, Send, Trash2, XCircle } from 'lucide-react'
import { useState } from 'react'
import {
  useApproveRequest,
  useCancelRequest,
  useCreateRequest,
  useMyRequests,
  usePendingRequests,
  useRejectRequest,
} from '@/hooks/useRequests'
import type { Request, RequestStatus, RequestType } from '@/lib/apiClient'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  leave: '休暇申請',
  overtime: '残業申請',
  correction: '打刻修正',
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '却下',
  cancelled: '取り消し済み',
}

const STATUS_BADGE: Record<RequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const STATUS_ICON: Record<RequestStatus, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  approved: <CheckCircle className="h-3.5 w-3.5" />,
  rejected: <XCircle className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
}

// ─── フォーム型 ───────────────────────────────────────────────────────────────

interface CreateForm {
  requestType: RequestType
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  reason: string
}

function emptyForm(): CreateForm {
  return {
    requestType: 'leave',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    reason: '',
  }
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—'
  return d.replace(/-/g, '/')
}

function formatDateTime(iso: string): string {
  const dt = new Date(iso)
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

function needsDates(type: RequestType): boolean {
  return type === 'leave' || type === 'overtime' || type === 'correction'
}

function needsTimes(type: RequestType): boolean {
  return type === 'overtime' || type === 'correction'
}

// ─── 申請フォーム ─────────────────────────────────────────────────────────────

interface CreateFormProps {
  onClose: () => void
}

function CreateRequestForm({ onClose }: CreateFormProps) {
  const createMut = useCreateRequest()
  const [form, setForm] = useState<CreateForm>(emptyForm())
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<CreateForm>) => setForm((f) => ({ ...f, ...patch }))
  const showDates = needsDates(form.requestType)
  const showTimes = needsTimes(form.requestType)

  async function handleSubmit() {
    setError(null)
    try {
      await createMut.mutateAsync({
        requestType: form.requestType,
        startDate: showDates && form.startDate ? form.startDate : null,
        endDate: showDates && form.endDate ? form.endDate : null,
        startTime: showTimes && form.startTime ? form.startTime : null,
        endTime: showTimes && form.endTime ? form.endTime : null,
        reason: form.reason.trim() || null,
      })
      onClose()
    } catch {
      setError('申請の送信に失敗しました。')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="rf-type" className="block text-sm font-medium text-gray-700 mb-1">
          申請種別
        </label>
        <select
          id="rf-type"
          value={form.requestType}
          onChange={(e) => set({ requestType: e.target.value as RequestType })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {(Object.keys(REQUEST_TYPE_LABELS) as RequestType[]).map((t) => (
            <option key={t} value={t}>
              {REQUEST_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {showDates && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rf-start" className="block text-sm font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              id="rf-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set({ startDate: e.target.value, endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="rf-end" className="block text-sm font-medium text-gray-700 mb-1">
              終了日
            </label>
            <input
              id="rf-end"
              type="date"
              value={form.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {showTimes && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rf-stime" className="block text-sm font-medium text-gray-700 mb-1">
              開始時刻
            </label>
            <input
              id="rf-stime"
              type="time"
              value={form.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="rf-etime" className="block text-sm font-medium text-gray-700 mb-1">
              終了時刻
            </label>
            <input
              id="rf-etime"
              type="time"
              value={form.endTime}
              onChange={(e) => set({ endTime: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="rf-reason" className="block text-sm font-medium text-gray-700 mb-1">
          理由・備考
        </label>
        <textarea
          id="rf-reason"
          value={form.reason}
          onChange={(e) => set({ reason: e.target.value })}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="申請理由を入力してください"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={createMut.isPending}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {createMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4" />
              申請を送信
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}

// ─── 申請カード ───────────────────────────────────────────────────────────────

interface RequestCardProps {
  req: Request
  onCancel?: (id: string) => void
  cancelPending?: boolean
}

function RequestCard({ req, onCancel, cancelPending }: RequestCardProps) {
  const status = req.status as RequestStatus
  const type = req.requestType as RequestType

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">
            {REQUEST_TYPE_LABELS[type] ?? type}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status]}`}
          >
            {STATUS_ICON[status]}
            {STATUS_LABELS[status]}
          </span>
        </div>

        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
          {(req.startDate || req.endDate) && (
            <p>
              期間: {formatDate(req.startDate)}
              {req.endDate && req.endDate !== req.startDate ? ` 〜 ${formatDate(req.endDate)}` : ''}
            </p>
          )}
          {(req.startTime || req.endTime) && (
            <p>
              時刻: {req.startTime ?? '—'} 〜 {req.endTime ?? '—'}
            </p>
          )}
          {req.reason && <p className="truncate">理由: {req.reason}</p>}
          <p className="text-gray-400">申請日時: {formatDateTime(req.createdAt)}</p>
        </div>
      </div>

      {onCancel && status === 'pending' && (
        <button
          type="button"
          onClick={() => onCancel(req.id)}
          disabled={cancelPending}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
          aria-label="取り消し"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ─── 承認カード ───────────────────────────────────────────────────────────────

interface PendingCardProps {
  req: Request
  onApprove: (id: string, comment: string) => void
  onReject: (id: string, comment: string) => void
  isPending: boolean
}

function PendingCard({ req, onApprove, onReject, isPending }: PendingCardProps) {
  const type = req.requestType as RequestType
  const [comment, setComment] = useState('')

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-900">
          {REQUEST_TYPE_LABELS[type] ?? type}
        </span>
        <span className="text-xs text-gray-400">申請 {formatDateTime(req.createdAt)}</span>
      </div>

      <div className="text-xs text-gray-500 space-y-0.5">
        {(req.startDate || req.endDate) && (
          <p>
            期間: {formatDate(req.startDate)}
            {req.endDate && req.endDate !== req.startDate ? ` 〜 ${formatDate(req.endDate)}` : ''}
          </p>
        )}
        {(req.startTime || req.endTime) && (
          <p>
            時刻: {req.startTime ?? '—'} 〜 {req.endTime ?? '—'}
          </p>
        )}
        {req.reason && <p>理由: {req.reason}</p>}
      </div>

      <div>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="コメント（任意）"
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onApprove(req.id, comment)}
          disabled={isPending}
          className="flex items-center gap-1.5 bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          承認
        </button>
        <button
          type="button"
          onClick={() => onReject(req.id, comment)}
          disabled={isPending}
          className="flex items-center gap-1.5 bg-red-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" />
          却下
        </button>
      </div>
    </div>
  )
}

// ─── ページ ──────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const [tab, setTab] = useState<'my' | 'pending'>('my')
  const [showForm, setShowForm] = useState(false)

  const { data: myRequests = [], isLoading: myLoading } = useMyRequests()
  const { data: pendingRequests = [], isLoading: pendingLoading } = usePendingRequests()
  const cancelMut = useCancelRequest()
  const approveMut = useApproveRequest()
  const rejectMut = useRejectRequest()

  function handleCancel(id: string) {
    cancelMut.mutate(id)
  }

  function handleApprove(id: string, comment: string) {
    approveMut.mutate({ id, comment: comment || null })
  }

  function handleReject(id: string, comment: string) {
    rejectMut.mutate({ id, comment: comment || null })
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">申請</h1>
        {tab === 'my' && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            申請を作成
          </button>
        )}
      </div>

      {/* 申請フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">新規申請</h2>
          <CreateRequestForm onClose={() => setShowForm(false)} />
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('my')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'my'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          自分の申請
          {myRequests.filter((r) => r.status === 'pending').length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
              {myRequests.filter((r) => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          承認待ち
          {pendingRequests.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* 自分の申請タブ */}
      {tab === 'my' &&
        (myLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : myRequests.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">申請がありません</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {myRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                onCancel={handleCancel}
                cancelPending={cancelMut.isPending}
              />
            ))}
          </div>
        ))}

      {/* 承認待ちタブ */}
      {tab === 'pending' &&
        (pendingLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">承認待ちの申請はありません</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {pendingRequests.map((req) => (
              <PendingCard
                key={req.id}
                req={req}
                onApprove={handleApprove}
                onReject={handleReject}
                isPending={approveMut.isPending || rejectMut.isPending}
              />
            ))}
          </div>
        ))}
    </div>
  )
}
