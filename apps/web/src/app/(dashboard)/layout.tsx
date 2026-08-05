'use client'

import { Clock, Mail, Menu, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ResendVerificationButton } from '@/components/ResendVerificationButton'
import { useMe } from '@/hooks/useAuth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError, refetch } = useMe()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const handleMobileMenuClose = useCallback(() => setIsMobileMenuOpen(false), [])

  useEffect(() => {
    if (!isLoading && isError) {
      router.replace('/login')
    }
  }, [isLoading, isError, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">読み込み中...</div>
      </div>
    )
  }

  if (!user) return null

  if (!user.emailVerified) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <Mail className="h-8 w-8 text-blue-600 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-800 mb-2">メールアドレスが未確認です</h1>
          <p className="text-sm text-slate-600 mb-4">
            {user.email} 宛に送信された確認メール内のリンクをクリックして、認証を完了してください。
          </p>
          <ResendVerificationButton email={user.email} onAlreadyVerified={() => refetch()} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={isMobileMenuOpen} onClose={handleMobileMenuClose} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* モバイル用ヘッダー */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="メニューを開く"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-600 p-1">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-800">KintaiHub</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
