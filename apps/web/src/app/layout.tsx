import type { Metadata } from 'next'
import { QueryProvider } from '@/providers/QueryProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'KintaiHub — 勤怠管理',
  description: 'SES業界向けクラウド型勤怠管理SaaS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
