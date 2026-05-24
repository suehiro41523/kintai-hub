'use client'

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import {
  useBillingContracts,
  useBillingSummaries,
  useCalculateBillingSummary,
  useConfirmBillingSummary,
  useCreateBillingContract,
  useDeleteBillingContract,
  useUpdateBillingContract,
} from '@/hooks/useBilling'
import { useWorkTypes } from '@/hooks/useClock'
import type { BillingContract, BillingType, WorkType } from '@/lib/apiClient'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  fixed: '固定',
  hourly: '時間精算',
  range: '上下幅あり',
  project: 'プロジェクト',
}

const BILLING_TYPE_BADGE: Record<BillingType, string> = {
  fixed: 'bg-blue-100 text-blue-700',
  hourly: 'bg-green-100 text-green-700',
  range: 'bg-amber-100 text-amber-700',
  project: 'bg-purple-100 text-purple-700',
}

// ─── 型 ──────────────────────────────────────────────────────────────────────

interface ContractFormState {
  id: string | null
  workTypeId: string
  clientName: string
  billingType: BillingType
  minHours: string
  maxHours: string
  baseAmount: string
  overRate: string
  underRate: string
  contractStart: string
  contractEnd: string
}

function emptyForm(workTypeId = ''): ContractFormState {
  return {
    id: null,
    workTypeId,
    clientName: '',
    billingType: 'fixed',
    minHours: '',
    maxHours: '',
    baseAmount: '',
    overRate: '',
    underRate: '',
    contractStart: '',
    contractEnd: '',
  }
}

function contractToForm(c: BillingContract): ContractFormState {
  return {
    id: c.id,
    workTypeId: c.workTypeId,
    clientName: c.clientName,
    billingType: c.billingType as BillingType,
    minHours: c.minHours?.toString() ?? '',
    maxHours: c.maxHours?.toString() ?? '',
    baseAmount: c.baseAmount?.toString() ?? '',
    overRate: c.overRate?.toString() ?? '',
    underRate: c.underRate?.toString() ?? '',
    contractStart: c.contractStart,
    contractEnd: c.contractEnd ?? '',
  }
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function parseOptionalNum(s: string): number | null {
  const v = Number(s)
  return s.trim() === '' || Number.isNaN(v) ? null : v
}

function formatAmount(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('ja-JP')
}

function workTypeName(workTypeId: string, workTypes: WorkType[]): string {
  return workTypes.find((w) => w.id === workTypeId)?.name ?? workTypeId
}

// ─── 契約フォーム ──────────────────────────────────────────────────────────────

interface ContractFormProps {
  form: ContractFormState
  workTypes: WorkType[]
  onChange: (f: ContractFormState) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
}

function ContractForm({
  form,
  workTypes,
  onChange,
  onSubmit,
  onCancel,
  isPending,
}: ContractFormProps) {
  const set = (patch: Partial<ContractFormState>) => onChange({ ...form, ...patch })
  const showRange = form.billingType === 'range'
  const showBase =
    form.billingType === 'fixed' || form.billingType === 'project' || form.billingType === 'range'
  const showOverRate = form.billingType === 'hourly' || form.billingType === 'range'
  const showUnderRate = form.billingType === 'range'

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="cf-worktype" className="block text-sm font-medium text-gray-700 mb-1">
          ワークタイプ
        </label>
        <select
          id="cf-worktype"
          value={form.workTypeId}
          onChange={(e) => set({ workTypeId: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">選択してください</option>
          {workTypes.map((wt) => (
            <option key={wt.id} value={wt.id}>
              {wt.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="cf-client" className="block text-sm font-medium text-gray-700 mb-1">
          クライアント名
        </label>
        <input
          id="cf-client"
          type="text"
          value={form.clientName}
          onChange={(e) => set({ clientName: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="株式会社〇〇"
        />
      </div>

      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">精算タイプ</p>
        <div className="grid grid-cols-2 gap-2">
          {(['fixed', 'hourly', 'range', 'project'] as BillingType[]).map((bt) => (
            <label
              key={bt}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                form.billingType === bt
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="billingType"
                value={bt}
                checked={form.billingType === bt}
                onChange={() => set({ billingType: bt })}
                className="sr-only"
              />
              {BILLING_TYPE_LABELS[bt]}
            </label>
          ))}
        </div>
      </div>

      {showBase && (
        <div>
          <label htmlFor="cf-base" className="block text-sm font-medium text-gray-700 mb-1">
            基本金額（円）
          </label>
          <input
            id="cf-base"
            type="number"
            value={form.baseAmount}
            onChange={(e) => set({ baseAmount: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="500000"
          />
        </div>
      )}

      {showRange && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-min" className="block text-sm font-medium text-gray-700 mb-1">
              下限時間（h）
            </label>
            <input
              id="cf-min"
              type="number"
              value={form.minHours}
              onChange={(e) => set({ minHours: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="140"
            />
          </div>
          <div>
            <label htmlFor="cf-max" className="block text-sm font-medium text-gray-700 mb-1">
              上限時間（h）
            </label>
            <input
              id="cf-max"
              type="number"
              value={form.maxHours}
              onChange={(e) => set({ maxHours: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="180"
            />
          </div>
        </div>
      )}

      {showOverRate && (
        <div>
          <label htmlFor="cf-over" className="block text-sm font-medium text-gray-700 mb-1">
            {form.billingType === 'hourly' ? '時間単価（円/h）' : '超過単価（円/h）'}
          </label>
          <input
            id="cf-over"
            type="number"
            value={form.overRate}
            onChange={(e) => set({ overRate: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="3000"
          />
        </div>
      )}

      {showUnderRate && (
        <div>
          <label htmlFor="cf-under" className="block text-sm font-medium text-gray-700 mb-1">
            控除単価（円/h）
          </label>
          <input
            id="cf-under"
            type="number"
            value={form.underRate}
            onChange={(e) => set({ underRate: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="3000"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cf-start" className="block text-sm font-medium text-gray-700 mb-1">
            契約開始日
          </label>
          <input
            id="cf-start"
            type="date"
            value={form.contractStart}
            onChange={(e) => set({ contractStart: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="cf-end" className="block text-sm font-medium text-gray-700 mb-1">
            契約終了日（任意）
          </label>
          <input
            id="cf-end"
            type="date"
            value={form.contractEnd}
            onChange={(e) => set({ contractEnd: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !form.workTypeId || !form.clientName || !form.contractStart}
          className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : form.id ? (
            '更新'
          ) : (
            '作成'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}

// ─── 契約タブ ─────────────────────────────────────────────────────────────────

function ContractsTab({ workTypes }: { workTypes: WorkType[] }) {
  const { data: contracts = [], isLoading } = useBillingContracts()
  const createMut = useCreateBillingContract()
  const updateMut = useUpdateBillingContract()
  const deleteMut = useDeleteBillingContract()

  const [form, setForm] = useState<ContractFormState | null>(null)
  const [duplicateConfirm, setDuplicateConfirm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openCreate() {
    setDuplicateConfirm(false)
    setForm(emptyForm(workTypes?.[0]?.id ?? ''))
  }

  function openEdit(c: BillingContract) {
    setDuplicateConfirm(false)
    setForm(contractToForm(c))
  }

  async function doSubmit() {
    if (!form) return
    const payload = {
      workTypeId: form.workTypeId,
      clientName: form.clientName,
      billingType: form.billingType,
      minHours: parseOptionalNum(form.minHours),
      maxHours: parseOptionalNum(form.maxHours),
      baseAmount: parseOptionalNum(form.baseAmount),
      overRate: parseOptionalNum(form.overRate),
      underRate: parseOptionalNum(form.underRate),
      contractStart: form.contractStart,
      contractEnd: form.contractEnd || null,
    }
    if (form.id) {
      await updateMut.mutateAsync({ id: form.id, data: payload })
    } else {
      await createMut.mutateAsync(payload)
    }
    setDuplicateConfirm(false)
    setForm(null)
  }

  async function handleSubmit() {
    if (!form) return
    const duplicate = contracts.some(
      (c) =>
        c.clientName.trim().toLowerCase() === form.clientName.trim().toLowerCase() &&
        c.id !== form.id,
    )
    if (duplicate) {
      setDuplicateConfirm(true)
      return
    }
    await doSubmit()
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    try {
      await deleteMut.mutateAsync(id)
      setDeleteId(null)
    } catch {
      setDeleteError('精算済みサマリーが存在するため削除できません')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          契約を追加
        </button>
      </div>

      {contracts.length === 0 && !form && (
        <div className="text-center py-16 text-gray-400 text-sm">
          契約がありません。「契約を追加」から登録してください。
        </div>
      )}

      <div className="space-y-3">
        {contracts.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
            {form?.id === c.id ? (
              <ContractForm
                form={form}
                workTypes={workTypes}
                onChange={setForm}
                onSubmit={handleSubmit}
                onCancel={() => setForm(null)}
                isPending={updateMut.isPending}
              />
            ) : deleteId === c.id ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-700 text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  この契約を削除しますか？
                </div>
                {deleteError && <p className="text-red-600 text-xs">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={deleteMut.isPending}
                    className="flex-1 bg-red-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleteMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      '削除'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteId(null)
                      setDeleteError(null)
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg border border-gray-200 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{c.clientName}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${BILLING_TYPE_BADGE[c.billingType as BillingType]}`}
                    >
                      {BILLING_TYPE_LABELS[c.billingType as BillingType]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {workTypeName(c.workTypeId, workTypes)} · {c.contractStart} ～{' '}
                    {c.contractEnd ?? '終了日なし'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.billingType === 'range' &&
                      `${c.minHours ?? '?'}h〜${c.maxHours ?? '?'}h · 基本 ¥${formatAmount(c.baseAmount)} · 超過 ¥${formatAmount(c.overRate)}/h · 控除 ¥${formatAmount(c.underRate)}/h`}
                    {c.billingType === 'hourly' && `¥${formatAmount(c.overRate)}/h`}
                    {(c.billingType === 'fixed' || c.billingType === 'project') &&
                      `¥${formatAmount(c.baseAmount)}/月`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(c.id)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                    aria-label="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {form && !form.id && (
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-sm font-medium text-gray-900 mb-4">新規契約</p>
          <ContractForm
            form={form}
            workTypes={workTypes}
            onChange={(f) => {
              setDuplicateConfirm(false)
              setForm(f)
            }}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDuplicateConfirm(false)
              setForm(null)
            }}
            isPending={createMut.isPending}
          />
        </div>
      )}

      {/* 重複クライアント名確認ダイアログ */}
      {duplicateConfirm && form && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDuplicateConfirm(false)}
          onKeyDown={(e) => e.key === 'Escape' && setDuplicateConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <h2 className="text-base font-semibold text-gray-900">
                クライアント名が重複しています
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              「{form.clientName}」はすでに登録されているクライアント名です。このまま登録しますか？
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={doSubmit}
                disabled={createMut.isPending || updateMut.isPending}
                className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createMut.isPending || updateMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  'このまま登録'
                )}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 精算タブ ─────────────────────────────────────────────────────────────────

function SummariesTab({ workTypes }: { workTypes: WorkType[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: contracts = [] } = useBillingContracts()
  const { data: summaries = [], isLoading } = useBillingSummaries(year, month)
  const calculateMut = useCalculateBillingSummary()
  const confirmMut = useConfirmBillingSummary()

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }
  function nextMonth() {
    if (year >= currentYear && month >= currentMonth) return
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const activeContracts = contracts.filter(
    (c) => c.contractStart <= monthEnd && (c.contractEnd === null || c.contractEnd >= monthStart),
  )

  const summaryMap = new Map(summaries.map((s) => [s.contractId, s]))

  return (
    <div className="space-y-4">
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
          disabled={year >= currentYear && month >= currentMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="次月"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          契約が登録されていません。「契約」タブから登録してください。
        </div>
      ) : activeContracts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          この月に有効な契約がありません。
        </div>
      ) : (
        <div className="space-y-3">
          {activeContracts.map((c) => {
            const summary = summaryMap.get(c.id)
            const confirmed = summary?.status === 'confirmed'
            const isCalcPending =
              calculateMut.isPending && calculateMut.variables?.contractId === c.id
            const isConfirmPending =
              confirmMut.isPending && confirmMut.variables?.summaryId === summary?.id

            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{c.clientName}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${BILLING_TYPE_BADGE[c.billingType as BillingType]}`}
                      >
                        {BILLING_TYPE_LABELS[c.billingType as BillingType]}
                      </span>
                      {confirmed && (
                        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          確定済
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {workTypeName(c.workTypeId, workTypes)}
                    </p>
                  </div>

                  {!confirmed && (
                    <button
                      type="button"
                      onClick={() => calculateMut.mutate({ contractId: c.id, year, month })}
                      disabled={isCalcPending}
                      className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isCalcPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      計算
                    </button>
                  )}
                </div>

                {summary && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">実稼働時間</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {summary.actualHours}h
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">精算時間</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {summary.billingHours}h
                        </span>
                      </div>
                      {summary.overHours !== null && (
                        <div>
                          <span className="text-gray-500">超過時間</span>
                          <span className="ml-2 font-medium text-orange-600">
                            +{summary.overHours}h
                          </span>
                        </div>
                      )}
                      {summary.underHours !== null && (
                        <div>
                          <span className="text-gray-500">控除時間</span>
                          <span className="ml-2 font-medium text-red-600">
                            -{summary.underHours}h
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                      <div>
                        <span className="text-xs text-gray-500">請求金額</span>
                        <span className="ml-2 text-base font-bold text-gray-900">
                          ¥{summary.billingAmount.toLocaleString('ja-JP')}
                        </span>
                      </div>
                      {!confirmed && (
                        <button
                          type="button"
                          onClick={() => confirmMut.mutate({ summaryId: summary.id, year, month })}
                          disabled={isConfirmPending}
                          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isConfirmPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          確定
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!summary && (
                  <p className="text-xs text-gray-400">「計算」を押すと今月の精算額を算出します</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ページ ──────────────────────────────────────────────────────────────────

type Tab = 'contracts' | 'summaries'

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('summaries')
  const { data: workTypesData, isLoading: wtLoading } = useWorkTypes()
  const workTypes = workTypesData?.workTypes ?? []

  if (wtLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">精算・請求</h1>

      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(
          [
            ['summaries', '精算'],
            ['contracts', '契約管理'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summaries' ? (
        <SummariesTab workTypes={workTypes} />
      ) : (
        <ContractsTab workTypes={workTypes} />
      )}
    </div>
  )
}
