import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    // NEXT_PUBLIC_API_URL が設定されている場合は本番環境 → rewrite 不要（直接 API を呼ぶ）
    // 未設定の場合はローカル開発 → Next.js 経由でプロキシする
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

// Cloudflare Workersのバインディング(今はapps/webに無いが将来のため)に`next dev`からアクセスできるようにする。
// ローカル開発の挙動自体は変えない(詳細はTECH-STACK.md「Cloudflareへの移行に伴うランタイム変更」参照)
initOpenNextCloudflareForDev()

export default nextConfig
