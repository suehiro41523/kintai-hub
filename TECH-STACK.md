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
| 認証 | Supabase Auth（マネージド） | latest |
| バリデーション | Zod（packages/typesと共通） | 3.x |
| テスト | Vitest | latest |

## インフラ・外部サービス

クラウド戦略はCloudflareに統一（詳細は `docs/tech-selection.md` を参照）。
まだPhase 1すら未リリースのため、Cloudflareは最初のインフラ（Phase 1）として採用する。
Phase 2（スケール後）の構成は未定で、リリース後の状況を見て別途検討する。

| 用途 | Phase 1（無料枠） |
|------|----------------------|
| フロント/APIホスティング | Cloudflare Workers（Free） |
| DB | Neon PostgreSQL（無料枠）+ Cloudflare Hyperdrive |
| キャッシュ | Upstash Redis（無料枠） |
| メール | Resend（無料枠） |
| ファイル | Cloudflare R2（無料枠） |
| CI/CD | GitHub Actions |
| エラー監視 | Sentry |
| 課金（サブスクリプション） | Stripe（Checkout + Customer Portal） |

### Vercel/RenderからCloudflareへの移行に伴うランタイム変更

現在の実装（`apps/api`が`@hono/node-server`でNode常駐プロセスとして動く、`postgres`パッケージでDBへ直接TCP接続する等）はCloudflare Workers環境では動かないため、以下の変更が必要です。

| 対象 | 現状 | Cloudflare移行後 |
|---|---|---|
| APIエントリーポイント | `serve({ fetch: app.fetch, port: 3001 })`（`apps/api/src/index.ts`） | `export default { fetch: app.fetch }`形式のWorkersエクスポートに変更（Hono自体はWorkers対応済み） |
| DB接続 | `postgres`パッケージで`DATABASE_URL`に直接TCP接続（`apps/api/src/db/index.ts`） | Cloudflare Hyperdriveバインディング経由で接続（`nodejs_compat`互換フラグが必要）。Drizzle ORM・RLSポリシー・スキーマ定義は変更不要 |
| 環境変数 | `dotenv/config`でローカル`.env`を読み込み | Workersでは`.env`は機能しない。`wrangler.toml`のvars（平文）/secrets（機密情報）に置き換え |
| Stripe SDK | Node標準のhttpクライアント | `Stripe.createFetchHttpClient()`でfetchベースのクライアントに切り替え |
| フロントエンド | Next.js 15をVercelにデプロイ | `@opennextjs/cloudflare`でCloudflare Workers上にデプロイ。`next-pwa`（Service Worker生成）との互換性は導入時に要検証 |
| Upstash Redis / Resend | REST API（fetchベース） | 変更不要（元々Workers互換） |

## 環境変数

### apps/api/.env
```
DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=re_...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=...              # フロントにも渡す公開キー
SUPABASE_SERVICE_ROLE_KEY=...      # サーバー専用。Admin API（ユーザー作成・招待）用。フロントに露出させない
SUPABASE_JWT_SECRET=...            # apps/api側でのJWT検証用（Supabase Dashboard > Settings > API）
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STANDARD=price_...   # Standardプラン（¥400/人/月・仮）のPrice ID
STRIPE_PRICE_PRO=price_...        # Proプラン（¥700/人/月・仮）のPrice ID
```

認証をBetter AuthからSupabase Authに変更したため（詳細は`AUTH-DESIGN.md`参照）、`BETTER_AUTH_SECRET`・`BETTER_AUTH_URL`は不要になった。

### apps/web/.env.local に追加

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
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
