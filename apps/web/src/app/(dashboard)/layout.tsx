'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { useMe } from '@/hooks/useAuth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useMe()
  const router = useRouter()

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

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
