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
| 課金（サブスクリプション） | Stripe（Checkout + Customer Portal） | Stripe |

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
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STANDARD=price_...   # Standardプラン（¥400/人/月・仮）のPrice ID
STRIPE_PRICE_PRO=price_...        # Proプラン（¥700/人/月・仮）のPrice ID
```

Stripe関連の補足（2026-09-22追加。詳細は `apps/api/src/routes/subscription/`, `apps/api/src/routes/webhooks/stripe.ts` 参照）:

- **決済方式**: Stripe Checkout（ホステッドページ）+ Customer Portal。カード情報は自前では保持しない
- **対象プラン**: Free（Stripe未経由）/ Standard・Pro（Checkout経由の人数課金サブスクリプション）。Enterpriseは個別見積もりのためStripe外で `core.tenants.plan` を手動設定する運用
- **人数（quantity）同期**: 招待・削除に連動した自動同期はせず、管理画面（`/settings/subscription`）からの手動調整のみ（v1のスコープ）
- **Webhook**: `POST /api/v1/webhooks/stripe` で `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.payment_failed` を処理し、`core.tenants` の `plan` / `subscription_status` / `current_period_end` / `billed_seats` を同期する

### apps/web/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```
