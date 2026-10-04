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
        // 'localhost' はIPv6(::1)に解決される環境があり、WSL2等でループバック接続が失敗することがあるため
        // 明示的にIPv4ループバックを指定する
        destination: 'http://127.0.0.1:3001/api/:path*',
      },
    ]
  },
}

export default nextConfig
