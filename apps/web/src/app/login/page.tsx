'use client'

import { Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSignIn } from '@/hooks/useAuth'
import { ApiError } from '@/lib/apiClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const signIn = useSignIn()

  useEffect(() => {
    if (signIn.isSuccess) {
      router.replace('/clock')
    }
  }, [signIn.isSuccess, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await signIn.mutateAsync({ email, password })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('エラーが発生しました')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm px-4">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="rounded-lg bg-blue-600 p-2">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-2xl tracking-tight">KintaiHub</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-lg font-semibold text-slate-800 mb-5">ログイン</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={signIn.isPending}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {signIn.isPending ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          テスト認証: admin@example.com / password
        </p>
      </div>
    </div>
  )
}
