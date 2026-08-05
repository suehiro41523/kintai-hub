'use client'

import { AlertTriangle, CheckCircle2, Clock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { ResendVerificationButton } from '@/components/ResendVerificationButton'
import { useMe } from '@/hooks/useAuth'

type ViewState = 'checking' | 'waiting' | 'verified' | 'expired' | 'invalid'

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const { data: user, isLoading, refetch } = useMe()

  const view: ViewState =
    errorParam === 'TOKEN_EXPIRED'
      ? 'expired'
      : errorParam === 'INVALID_TOKEN' || errorParam === 'USER_NOT_FOUND'
        ? 'invalid'
        : isLoading
          ? 'checking'
          : user?.emailVerified
            ? 'verified'
            : 'waiting'

  // 検証済みなら数秒後にダッシュボードへ自動遷移
  useEffect(() => {
    if (view !== 'verified') return
    const t = setTimeout(() => router.replace('/clock'), 2500)
    return () => clearTimeout(t)
  }, [view, router])

  // 別タブでの検証完了を、このタブがフォアグラウンドに復帰したタイミングで検知する
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      void refetch().then((result) => {
        if (result.data?.emailVerified) {
          router.replace('/clock')
        }
      })
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refetch, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm px-4">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="rounded-lg bg-blue-600 p-2">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-2xl tracking-tight">KintaiHub</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          {view === 'checking' && (
            <p aria-live="polite" className="text-sm text-slate-600">
              確認しています…
            </p>
          )}

          {view === 'waiting' && (
            <>
              <Mail className="h-8 w-8 text-blue-600 mx-auto mb-3" />
              <h1 className="text-lg font-semibold text-slate-800 mb-2">確認メールを送信しました</h1>
              <p className="text-sm text-slate-600 mb-1">
                {user?.email ?? 'ご登録のメールアドレス'} 宛に
              </p>
              <p className="text-sm text-slate-600 mb-4">
                確認リンクを送信しました。メール内のリンクをクリックして登録を完了してください。
              </p>
              {user?.email && (
                <ResendVerificationButton email={user.email} onAlreadyVerified={() => refetch()} />
              )}
              <p className="text-xs text-slate-400 mt-4">
                メールが届かない場合は迷惑メールフォルダをご確認いただくか、再送信をお試しください。
              </p>
            </>
          )}

          {view === 'verified' && (
            <>
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h1 className="text-lg font-semibold text-slate-800 mb-4">メール認証が完了しました</h1>
              <button
                type="button"
                onClick={() => router.replace('/clock')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                ダッシュボードへ進む
              </button>
            </>
          )}

          {view === 'expired' && (
            <>
              <AlertTriangle className="h-8 w-8 text-amber-600 mx-auto mb-3" />
              <h1 className="text-lg font-semibold text-slate-800 mb-4">
                リンクの有効期限が切れています
              </h1>
              {user?.email && (
                <ResendVerificationButton email={user.email} onAlreadyVerified={() => refetch()} />
              )}
            </>
          )}

          {view === 'invalid' && (
            <>
              <AlertTriangle className="h-8 w-8 text-amber-600 mx-auto mb-3" />
              <h1 className="text-lg font-semibold text-slate-800 mb-4">無効なリンクです</h1>
              <Link
                href="/login"
                className="block w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ログイン画面へ
              </Link>
            </>
          )}
        </div>

        {view === 'waiting' && (
          <p className="text-center text-sm text-slate-600 mt-4">
            メールアドレスを間違えましたか？{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-700">
              登録をやり直す
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
