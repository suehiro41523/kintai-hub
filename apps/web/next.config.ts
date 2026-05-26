import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    // NEXT_PUBLIC_API_URL が設定されている場合は本番環境 → rewrite 不要（直接 API を呼ぶ）
    // 未設定の場合はローカル開発 → Next.js 経由でプロキシして Cookie 問題を回避
    if (process.env.NEXT_PUBLIC_API_URL) {
      return []
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ]
  },
}

export default nextConfig
