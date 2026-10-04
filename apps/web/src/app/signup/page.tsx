'use client'

import { Clock, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSignUp } from '@/hooks/useAuth'
import { ApiError } from '@/lib/apiClient'

export default function SignupPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordMismatch, setPasswordMismatch] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [showLoginLink, setShowLoginLink] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const signUp = useSignUp()

  useEffect(() => {
    if (signUp.isSuccess) {
      router.replace(`/verify-email?email=${encodeURIComponent(email)}`)
    }
  }, [signUp.isSuccess, router, email])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBannerError(null)
    setShowLoginLink(false)
    setFieldErrors({})
    setPasswordMismatch(false)

    if (password !== passwordConfirm) {
      setPasswordMismatch(true)
      return
    }

    try {
      await signUp.mutateAsync({
        company_name: companyName,
        name,
        email,
        password,
        plan: 'free',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'VALIDATION_ERROR' && err.details) {
          const details: Record<string, string> = {}
          for (const d of err.details) details[d.field] = d.message
          setFieldErrors(details)
        } else if (err.code === 'CONFLICT') {
          setBannerError(err.message)
          setShowLoginLink(true)
        } else if (err.code === 'RATE_LIMITED') {
          setBannerError('試行回数が上限に達しました。しばらくしてから再度お試しください')
        } else {
          setBannerError(err.message)
        }
      } else {
        setBannerError('エラーが発生しました。時間をおいて再度お試しください')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md px-4">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="rounded-lg bg-blue-600 p-2">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-2xl tracking-tight">KintaiHub</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-lg font-semibold text-slate-800 mb-5">無料でアカウントを作成</h1>

          {bannerError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {bannerError}
              {showLoginLink && (
                <>
                  {' '}
                  <Link href="/login" className="font-medium underline">
                    ログインする
                  </Link>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">
                会社名
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="株式会社サンプル"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {fieldErrors.company_name && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.company_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                お名前
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="山田 太郎"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                パスワード
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="8文字以上"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-slate-700 mb-1">
                パスワード（確認）
              </label>
              <input
                id="passwordConfirm"
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {passwordMismatch && (
                <p className="mt-1 text-sm text-red-600">パスワードが一致しません</p>
              )}
            </div>

            <div className="flex items-start gap-2">
              <input
                id="agreed"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="agreed" className="text-sm text-slate-700">
                利用規約とプライバシーポリシーに同意する
              </label>
            </div>

            <button
              type="submit"
              disabled={signUp.isPending || !agreed}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {signUp.isPending ? '登録中...' : '無料で始める'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-4">
          すでにアカウントをお持ちですか？{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
            ログイン
          </Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-2">クレジットカード登録不要</p>
      </div>
    </div>
  )
}
