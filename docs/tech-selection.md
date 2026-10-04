# tech-selection.md — 技術選定書

> バージョン: 3.0 / 作成日: 2026-05-21 / 更新日: 2026-09-28 / クラウド戦略: Cloudflareで無料スタート（Phase 2以降は未定）

> 2026-09-28更新: クラウド戦略をVercel + Render + AWSからCloudflareに統一。理由は運用の単純化とR2・Workers・Hyperdriveの統合。DBはCloudflareが自前のPostgresを持たないため、Neon PostgreSQLをHyperdrive経由で利用する構成とした（D1はRLSが使えず本アプリのマルチテナント設計と相性が悪いため見送り）。
> また、Phase 1すらまだリリースしていない段階のため、Cloudflareは「将来移行する先」ではなく**Phase 1（最初のインフラ）**として採用する。Phase 2（スケール後）の構成は現時点で未検討であり、リリース後の状況を見て別途設計する。

---

## 1. 技術選定方針

| 原則 | 内容 |
|---|---|
| 無料枠優先 | Phase 1はCloudflare・Neon・Upstash等の無料枠で運用コスト0円を目指す |
| 型安全性 | フロント・バックエンド共にTypeScriptで統一し、バグを早期に検出する |
| シンプルさ優先 | 個人開発フェーズでは学習コスト・運用コストの低いツールを選ぶ |

| フェーズ | 想定規模 | インフラ | 月額コスト目安 |
|---|---|---|---|
| Phase 1（個人開発・未リリース） | 〜50ユーザー | Cloudflare Workers + Neon（無料枠） | ¥0〜1,000 |
| Phase 2以降 | 未定 | 未定（リリース後の状況を見て検討） | 未定 |

---

## 2. フロントエンド

| カテゴリ | 採用技術 | バージョン | 選定理由 |
|---|---|---|---|
| フレームワーク | Next.js | 15.x | App Router / `@opennextjs/cloudflare`でCloudflare Workersにデプロイ可能 |
| 言語 | TypeScript | 5.x | 型安全性・バックエンドとの型共有 |
| CSSフレームワーク | Tailwind CSS | 4.x | クラスベースで高速開発 |
| UIコンポーネント | shadcn/ui | latest | Tailwindベース・カスタマイズ自由 |
| 状態管理 | TanStack Query | 5.x | サーバー状態管理に特化 |
| フォーム管理 | React Hook Form | 7.x | Zodとの連携でバリデーション統一 |
| バリデーション | Zod | 3.x | フロント・バック共通のスキーマ定義 |
| テスト | Vitest + Testing Library | latest | 高速・Vite互換 |
| PWA対応 | next-pwa | latest | 打刻画面のオフライン対応 |

---

## 3. バックエンド

| カテゴリ | 採用技術 | バージョン | 選定理由 |
|---|---|---|---|
| フレームワーク | Hono.js | 4.x | 超軽量・TypeScript First・個人開発向き |
| 言語 | TypeScript | 5.x | フロントと共通化 |
| ランタイム | Cloudflare Workers（V8 isolate）/ Node.js 22.x LTS（ローカル開発） | — | 無料枠でコールドスタートなし・エッジ実行。Honoは元々Workers対応 |
| ORM | Drizzle ORM | latest | TypeScript First・SQLに近い記法 |
| 認証 | Supabase Auth（マネージド） | latest | JWTベースでエッジ実行と相性良好。MFA・OAuth標準対応。パスワード保管・漏洩リスクを自社で持たない（詳細は`AUTH-DESIGN.md`） |
| バリデーション | Zod | 3.x | フロントと共通スキーマ |
| テスト | Vitest | latest | 高速・設定不要 |
| コンテナ | Docker | latest | ローカル開発のPostgreSQL/Redis起動用途のみ。本番はCloudflare Workersのためコンテナ化不要 |

---

## 4. データベース・ミドルウェア

| カテゴリ | 採用技術（Phase 1） |
|---|---|
| メインDB | Neon PostgreSQL（無料枠）+ Cloudflare Hyperdrive |
| キャッシュ | Upstash Redis（無料 10K req/日） |
| ファイル保存 | Cloudflare R2（無料 10GB） |
| メール送信 | Resend（無料 3,000通/月）※Supabase Auth側のカスタムSMTPとしても利用 |
| 認証 | Supabase Auth（マネージド） |

### Upstash Redis 使用目的

認証はJWT（ステートレス検証）に変更したため、セッション管理用途は不要になった（詳細は`AUTH-DESIGN.md`）。

| 用途 | 概要 |
|---|---|
| 打刻レート制限 | 同一ユーザーの連続打刻防止（1分間隔制限） |
| 通知キュー | 打刻漏れ・申請通知の非同期処理キュー |
| 月次集計キャッシュ | ダッシュボードの重い集計クエリ結果をキャッシュ（TTL: 5分） |

---

## 5. インフラ構成（Phase 1）

| レイヤー | サービス | プラン | 制限・注意点 |
|---|---|---|---|
| フロントエンド | Cloudflare Workers（Next.js, `@opennextjs/cloudflare`） | Free（無料） | 10万リクエスト/日 |
| バックエンド | Cloudflare Workers（Hono.js） | Free（無料） | 10万リクエスト/日。コールドスタート・スリープなし |
| データベース | Neon PostgreSQL + Cloudflare Hyperdrive | Free（無料） | Neon無料枠0.5GB・Hyperdriveは無料枠あり |
| キャッシュ | Upstash Redis | Free（無料） | 10,000リクエスト/日・256MB上限 |
| メール | Resend | Free（無料） | 3,000通/月 |
| ファイル | Cloudflare R2 | Free（無料） | 10GB/月 |
| CI/CD | GitHub Actions | Free（無料） | 2,000分/月 |

### Phase 2以降

現時点では未定。リリースしてユーザー数・負荷の実態が見えてから、Cloudflareの上位プランへのアップグレードを軸に別途検討する。

---

## 6. Vercel/Render/AWS前提からの実装変更点

もともとの実装（本ファイルv1.0時点）はVercel + Renderを前提に書かれていたが未リリースのため、Cloudflareへの切り替えにあたって以下の実装変更が必要（詳細は `TECH-STACK.md` を参照）。

| 対象 | 変更内容 |
|---|---|
| `apps/api/src/index.ts` | `@hono/node-server`の`serve()`をWorkers向けの`export default { fetch: app.fetch }`に変更 |
| `apps/api/src/db/index.ts` | `postgres`パッケージの直接TCP接続を、Cloudflare Hyperdriveバインディング経由に変更（`nodejs_compat`フラグが必要）。Drizzleスキーマ・RLSポリシーは変更不要 |
| 環境変数 | `dotenv/config`によるローカル`.env`読み込みを廃止し、`wrangler.toml`のvars/secretsに移行 |
| Stripe SDK | `Stripe.createFetchHttpClient()`でfetchベースのHTTPクライアントに切り替え |
| `apps/web` | `@opennextjs/cloudflare`でのデプロイに変更。`next-pwa`（Service Worker生成）の互換性を導入時に検証 |
