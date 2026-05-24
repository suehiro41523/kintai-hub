'use client'

import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Settings, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useWorkTypes } from '@/hooks/useClock'
import {
  useCreateWorkType,
  useDeactivateWorkType,
  useReorderWorkTypes,
  useUpdateWorkType,
} from '@/hooks/useWorkTypes'
import type { BillingType, WorkType } from '@/lib/apiClient'

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
]

const BILLING_TYPES: { value: BillingType; label: string; desc: string }[] = [
  { value: 'fixed', label: '月額固定', desc: '稼働時間に関わらず月額固定' },
  { value: 'hourly', label: '時間精算', desc: '稼働時間 × 時間単価' },
  { value: 'range', label: '上下幅あり', desc: 'min〜max の範囲内は固定、超過・不足は単価精算' },
  { value: 'project', label: 'プロジェクト', desc: '成果物・マイルストーンベース' },
]

const BILLING_BADGE: Record<BillingType, string> = {
  fixed: 'bg-slate-100 text-slate-600',
  hourly: 'bg-blue-100 text-blue-700',
  range: 'bg-green-100 text-green-700',
  project: 'bg-violet-100 text-violet-700',
}

// ─── 型 ───────────────────────────────────────────────────────────────────────

interface FormState {
  id: string | null
  name: string
  color: string
  billingType: BillingType
  isBillable: boolean
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  color: '#3b82f6',
  billingType: 'fixed',
  isBillable: false,
}

// ─── サブコンポーネント ────────────────────────────────────────────────────────

function ColorSwatch({
  color,
  selected,
  onClick,
}: {
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 w-7 rounded-full border-2 transition-transform ${
        selected ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'
      }`}
      style={{ backgroundColor: color }}
    />
  )
}

function WorkTypeForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initial: FormState
  onSubmit: (data: FormState) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 名前 */}
      <div>
        <label htmlFor="wt-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
          ワークタイプ名 <span className="text-red-500">*</span>
        </label>
        <input
          id="wt-name"
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="例: 客先A（○○社）"
          maxLength={100}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* カラー */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2">カラー</p>
        <div className="flex gap-2 flex-wrap">
          {COLOR_OPTIONS.map((c) => (
            <ColorSwatch
              key={c}
              color={c}
              selected={form.color === c}
              onClick={() => set('color', c)}
            />
          ))}
        </div>
      </div>

      {/* 精算タイプ */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2">精算タイプ</p>
        <div className="space-y-2">
          {BILLING_TYPES.map(({ value, label, desc }) => (
            <label
              key={value}
              className={`flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                form.billingType === value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="billingType"
                value={value}
                checked={form.billingType === value}
                onChange={() => set('billingType', value)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">{label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 精算対象 */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={form.isBillable}
              onChange={(e) => set('isBillable', e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-10 h-6 rounded-full transition-colors ${form.isBillable ? 'bg-blue-600' : 'bg-slate-300'}`}
            />
            <div
              className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isBillable ? 'translate-x-5' : 'translate-x-1'}`}
            />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-700">精算対象</div>
            <div className="text-xs text-slate-400">客先への請求計算に含める</div>
          </div>
        </label>
      </div>

      {/* ボタン */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isLoading || !form.name.trim()}
          className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {form.id ? '保存する' : '追加する'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function WorkTypesSettingsPage() {
  const { data: wtData, isLoading } = useWorkTypes()
  const workTypes = wtData?.workTypes ?? []

  const createMutation = useCreateWorkType()
  const updateMutation = useUpdateWorkType()
  const deactivateMutation = useDeactivateWorkType()
  const reorderMutation = useReorderWorkTypes()

  const [modalForm, setModalForm] = useState<FormState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deactivateMutation.isPending ||
    reorderMutation.isPending

  function openCreate() {
    setModalForm({ ...EMPTY_FORM, sortOrder: workTypes.length + 1 } as FormState & {
      sortOrder: number
    })
  }

  function openEdit(wt: WorkType) {
    setModalForm({
      id: wt.id,
      name: wt.name,
      color: wt.color,
      billingType: wt.billingType,
      isBillable: wt.isBillable,
    })
  }

  function closeModal() {
    setModalForm(null)
  }

  function handleSubmit(form: FormState) {
    if (form.id) {
      updateMutation.mutate(
        {
          id: form.id,
          data: {
            name: form.name,
            color: form.color,
            billingType: form.billingType,
            isBillable: form.isBillable,
          },
        },
        { onSuccess: closeModal },
      )
    } else {
      createMutation.mutate(
        {
          name: form.name,
          color: form.color,
          billingType: form.billingType,
          isBillable: form.isBillable,
          sortOrder: workTypes.length + 1,
        },
        { onSuccess: closeModal },
      )
    }
  }

  function handleDeactivate(id: string) {
    deactivateMutation.mutate(id, {
      onSuccess: () => setConfirmDeleteId(null),
    })
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...workTypes]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    reorderMutation.mutate(next.map((wt, i) => ({ id: wt.id, sortOrder: i + 1 })))
  }

  function moveDown(index: number) {
    if (index === workTypes.length - 1) return
    const next = [...workTypes]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    reorderMutation.mutate(next.map((wt, i) => ({ id: wt.id, sortOrder: i + 1 })))
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Settings className="h-3.5 w-3.5" />
          <span>設定</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 flex-1">ワークタイプ管理</h1>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            新規追加
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          客先・作業種別を定義します。打刻時の種別選択と精算計算に使用されます。
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {workTypes.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400 text-sm mb-4">ワークタイプがまだありません</p>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                最初のワークタイプを追加
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {workTypes.map((wt, index) => (
                <li key={wt.id} className="flex items-center gap-3 px-5 py-4">
                  {/* 並び替えボタン */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0 || isMutating}
                      className="rounded p-0.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === workTypes.length - 1 || isMutating}
                      className="rounded p-0.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* カラードット */}
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: wt.color }}
                  />

                  {/* 名前・バッジ */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{wt.name}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${BILLING_BADGE[wt.billingType as BillingType]}`}
                      >
                        {BILLING_TYPES.find((b) => b.value === wt.billingType)?.label}
                      </span>
                      {wt.isBillable ? (
                        <span className="text-xs text-emerald-600 font-medium">精算対象</span>
                      ) : (
                        <span className="text-xs text-slate-400">社内原価</span>
                      )}
                    </div>
                  </div>

                  {/* アクション */}
                  {confirmDeleteId === wt.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">無効化しますか？</span>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(wt.id)}
                        disabled={deactivateMutation.isPending}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                      >
                        {deactivateMutation.isPending && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        はい
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(wt)}
                        className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="編集"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(wt.id)}
                        className="rounded-lg p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="無効化"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* モーダル */}
      {modalForm && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop closes modal on click
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled on inner dialog
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modalForm.id ? 'ワークタイプを編集' : 'ワークタイプを追加'}
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && closeModal()}
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">
                {modalForm.id ? 'ワークタイプを編集' : 'ワークタイプを追加'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* フォーム */}
            <div className="px-6 py-5">
              <WorkTypeForm
                initial={modalForm}
                onSubmit={handleSubmit}
                onCancel={closeModal}
                isLoading={isSubmitting}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
