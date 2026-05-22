# TECH-STACK.md — 技術スタック

## フロントエンド（apps/web）

| 用途 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | Next.js | 15.x（App Router） |
| 言語 | TypeScript | 5.x |
| スタイリング | Tailwind CSS + shadcn/ui | 4.x |
| サーバー状態管理 | TanStack Query | v5 |
| フォーム | React Hook Form + Zod | 7.x |
| テスト | Vitest + Testing Library | latest |
| PWA | next-pwa | latest |

## バックエンド（apps/api）

| 用途 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | Hono.js | 4.x |
| 言語 | TypeScript | 5.x |
| ORM | Drizzle ORM | latest |
| 認証 | Better Auth | latest |
| バリデーション | Zod（packages/typesと共通） | 3.x |
| テスト | Vitest | latest |

## インフラ・外部サービス

| 用途 | Phase 1（現在・無料枠） | Phase 2（AWS移行後） |
|------|----------------------|---------------------|
| フロントホスティング | Vercel | CloudFront + S3 |
| APIホスティング | Render | AWS App Runner |
| DB | Render PostgreSQL | RDS PostgreSQL（Multi-AZ） |
| キャッシュ | Upstash Redis | ElastiCache |
| メール | Resend | Amazon SES |
| ファイル | Cloudflare R2 | Amazon S3 |
| CI/CD | GitHub Actions | GitHub Actions |
| エラー監視 | Sentry | Sentry |

## 環境変数

### apps/api/.env
```
DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=re_...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3001
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
```

### apps/web/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```
