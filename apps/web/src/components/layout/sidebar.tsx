'use client'

import {
  BarChart2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/clock', icon: Clock, label: '打刻' },
  { href: '/', icon: LayoutDashboard, label: 'ダッシュボード' },
  { href: '/shifts', icon: Calendar, label: 'シフト' },
  { href: '/requests', icon: FileText, label: '申請' },
  { href: '/reports', icon: BarChart2, label: 'レポート' },
  { href: '/billing', icon: DollarSign, label: '精算・請求' },
] as const

const SETTINGS_ITEMS = [
  { href: '/settings/users', icon: Users, label: '従業員管理' },
  { href: '/settings/work-types', icon: Settings, label: '設定' },
] as const

const MOCK_USER = { name: '田中太郎', department: '開発部' }

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* ロゴ */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <div className="rounded-lg bg-blue-600 p-1.5">
          <Clock className="h-5 w-5 text-white" />
        </div>
        <span className="font-bold text-slate-800 text-lg tracking-tight">KintaiHub</span>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <item.icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          )
        })}

        <div className="pt-4 pb-1 px-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            管理
          </span>
        </div>

        {SETTINGS_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <item.icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ユーザーフッター */}
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
            田
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{MOCK_USER.name}</div>
            <div className="text-xs text-slate-500 truncate">{MOCK_USER.department}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
