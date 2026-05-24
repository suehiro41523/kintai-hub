'use client'

import { AlertTriangle, Loader2, Pencil, Plus, UserX } from 'lucide-react'
import { useState } from 'react'
import { useCreateUser, useDeactivateUser, useUpdateUser, useUsers } from '@/hooks/useUsers'
import type { EmploymentType, User, UserRole } from '@/lib/apiClient'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  manager: 'マネージャー',
  employee: '従業員',
}

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  employee: 'bg-gray-100 text-gray-600',
}

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: '正社員',
  part_time: 'パートタイム',
  contract: '契約社員',
}

// ─── フォーム型 ───────────────────────────────────────────────────────────────

interface FormState {
  id: string | null
  name: string
  email: string
  role: UserRole
  employmentType: EmploymentType
  hourlyRate: string
  monthlySalary: string
}

function emptyForm(): FormState {
  return {
    id: null,
    name: '',
    email: '',
    role: 'employee',
    employmentType: 'full_time',
    hourlyRate: '',
    monthlySalary: '',
  }
}

function userToForm(u: User): FormState {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as UserRole,
    employmentType: u.employmentType as EmploymentType,
    hourlyRate: u.hourlyRate?.toString() ?? '',
    monthlySalary: u.monthlySalary?.toString() ?? '',
  }
}

function parseOptionalNum(s: string): number | null {
  const v = Number(s)
  return s.trim() === '' || Number.isNaN(v) ? null : v
}

// ─── フォームコンポーネント ────────────────────────────────────────────────────

interface UserFormProps {
  form: FormState
  onChange: (f: FormState) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}

function UserForm({ form, onChange, onSubmit, onCancel, isPending, error }: UserFormProps) {
  const set = (patch: Partial<FormState>) => onChange({ ...form, ...patch })
  const showHourly = form.employmentType === 'part_time' || form.employmentType === 'contract'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="uf-name" className="block text-sm font-medium text-gray-700 mb-1">
            氏名
          </label>
          <input
            id="uf-name"
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="田中 太郎"
          />
        </div>

        <div className="col-span-2">
          <label htmlFor="uf-email" className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            id="uf-email"
            type="email"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="taro@example.com"
          />
        </div>

        <div>
          <label htmlFor="uf-role" className="block text-sm font-medium text-gray-700 mb-1">
            役割
          </label>
          <select
            id="uf-role"
            value={form.role}
            onChange={(e) => set({ role: e.target.value as UserRole })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="uf-emp" className="block text-sm font-medium text-gray-700 mb-1">
            雇用形態
          </label>
          <select
            id="uf-emp"
            value={form.employmentType}
            onChange={(e) => set({ employmentType: e.target.value as EmploymentType })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {showHourly ? (
          <div className="col-span-2">
            <label htmlFor="uf-hourly" className="block text-sm font-medium text-gray-700 mb-1">
              時間単価（円）
            </label>
            <input
              id="uf-hourly"
              type="number"
              value={form.hourlyRate}
              onChange={(e) => set({ hourlyRate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1500"
            />
          </div>
        ) : (
          <div className="col-span-2">
            <label htmlFor="uf-salary" className="block text-sm font-medium text-gray-700 mb-1">
              月給（円）
            </label>
            <input
              id="uf-salary"
              type="number"
              value={form.monthlySalary}
              onChange={(e) => set({ monthlySalary: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="300000"
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !form.name.trim() || !form.email.trim()}
          className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : form.id ? (
            '更新'
          ) : (
            '追加'
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

// ─── ページ ──────────────────────────────────────────────────────────────────

export default function UsersSettingsPage() {
  const { data: userList = [], isLoading } = useUsers()
  const createMut = useCreateUser()
  const updateMut = useUpdateUser()
  const deactivateMut = useDeactivateUser()

  const [modalForm, setModalForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)

  function openCreate() {
    setFormError(null)
    setModalForm(emptyForm())
  }

  function openEdit(u: User) {
    setFormError(null)
    setModalForm(userToForm(u))
  }

  async function handleSubmit() {
    if (!modalForm) return
    setFormError(null)
    const payload = {
      name: modalForm.name.trim(),
      email: modalForm.email.trim(),
      role: modalForm.role,
      employmentType: modalForm.employmentType,
      hourlyRate: parseOptionalNum(modalForm.hourlyRate),
      monthlySalary: parseOptionalNum(modalForm.monthlySalary),
    }
    try {
      if (modalForm.id) {
        await updateMut.mutateAsync({ id: modalForm.id, data: payload })
      } else {
        await createMut.mutateAsync(payload)
      }
      setModalForm(null)
    } catch {
      setFormError('保存に失敗しました。メールアドレスが重複している可能性があります。')
    }
  }

  async function handleDeactivate() {
    if (!deactivateId) return
    await deactivateMut.mutateAsync(deactivateId)
    setDeactivateId(null)
  }

  const deactivateTarget = userList.find((u) => u.id === deactivateId)

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">従業員管理</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          従業員を追加
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : userList.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">従業員が登録されていません</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {userList.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              {/* アバター */}
              <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                {u.name.charAt(0)}
              </div>

              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{u.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role as UserRole]}`}
                  >
                    {ROLE_LABELS[u.role as UserRole] ?? u.role}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">{u.email}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">
                    {EMPLOYMENT_LABELS[u.employmentType as EmploymentType] ?? u.employmentType}
                  </span>
                  {u.hourlyRate !== null && (
                    <>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">
                        ¥{u.hourlyRate.toLocaleString('ja-JP')}/h
                      </span>
                    </>
                  )}
                  {u.monthlySalary !== null && (
                    <>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">
                        月給 ¥{u.monthlySalary.toLocaleString('ja-JP')}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* アクション */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  aria-label="編集"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeactivateId(u.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  aria-label="無効化"
                >
                  <UserX className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 追加・編集モーダル */}
      {modalForm && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModalForm(null)}
          onKeyDown={(e) => e.key === 'Escape' && setModalForm(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              {modalForm.id ? '従業員を編集' : '従業員を追加'}
            </h2>
            <UserForm
              form={modalForm}
              onChange={setModalForm}
              onSubmit={handleSubmit}
              onCancel={() => setModalForm(null)}
              isPending={createMut.isPending || updateMut.isPending}
              error={formError}
            />
          </div>
        </div>
      )}

      {/* 無効化確認モーダル */}
      {deactivateId && deactivateTarget && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeactivateId(null)}
          onKeyDown={(e) => e.key === 'Escape' && setDeactivateId(null)}
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
              <h2 className="text-base font-semibold text-gray-900">従業員を無効化しますか？</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{deactivateTarget.name}</span>{' '}
              を無効化します。この操作後はログインできなくなります。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivateMut.isPending}
                className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deactivateMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  '無効化'
                )}
              </button>
              <button
                type="button"
                onClick={() => setDeactivateId(null)}
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
