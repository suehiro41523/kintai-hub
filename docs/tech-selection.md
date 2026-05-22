# tech-selection.md — 技術選定書

> バージョン: 1.0 / 作成日: 2026-05-21 / クラウド戦略: Vercel + Render で無料スタート → AWS移行

---

## 1. 技術選定方針

| 原則 | 内容 |
|---|---|
| 無料枠優先 | Phase 1はVercel・Render・Upstash等の無料枠で運用コスト0円を目指す |
| 移行コスト最小 | Phase 1→2でコードの書き換えが発生しない技術・構成を選定する |
| 型安全性 | フロント・バックエンド共にTypeScriptで統一し、バグを早期に検出する |
| シンプルさ優先 | 個人開発フェーズでは学習コスト・運用コストの低いツールを選ぶ |

| フェーズ | 想定規模 | インフラ | 月額コスト目安 |
|---|---|---|---|
| Phase 1（個人開発） | 〜50ユーザー | Vercel + Render（無料枠） | ¥0〜1,000 |
| Phase 2（正式リリース） | 50〜500ユーザー | AWS（App Runner + RDS） | ¥5,000〜30,000 |
| Phase 3（スケール） | 500ユーザー〜 | AWS（ECS + Aurora） | 別途試算 |

---

## 2. フロントエンド

| カテゴリ | 採用技術 | バージョン | 選定理由 |
|---|---|---|---|
| フレームワーク | Next.js | 15.x | App Router / Vercelとの相性が最良 |
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
| ランタイム | Node.js | 22.x LTS | Render無料枠対応・App Runner対応 |
| ORM | Drizzle ORM | latest | TypeScript First・SQLに近い記法 |
| 認証 | Better Auth | latest | Hono対応・MFA・OAuth2対応 |
| バリデーション | Zod | 3.x | フロントと共通スキーマ |
| テスト | Vitest | latest | 高速・設定不要 |
| コンテナ | Docker | latest | Render→App Runner移行をDockerfileのみで対応 |

---

## 4. データベース・ミドルウェア

| カテゴリ | Phase 1（無料） | Phase 2（AWS） | 移行コスト |
|---|---|---|---|
| メインDB | Render PostgreSQL（無料 1GB） | RDS PostgreSQL（Multi-AZ） | pg_dumpで移行 |
| キャッシュ | Upstash Redis（無料 10K req/日） | ElastiCache（Redis） | 接続文字列の変更のみ |
| ファイル保存 | Cloudflare R2（無料 10GB） | Amazon S3 | SDKの差し替えのみ |
| メール送信 | Resend（無料 3,000通/月） | Amazon SES | SMTPアドレスの変更のみ |
| 認証 | Better Auth（セルフホスト） | Better Auth + Cognito（SSO） | プロバイダー追加のみ |

### Upstash Redis 使用目的

| 用途 | 概要 |
|---|---|
| セッション管理 | Better Authのセッショントークンをキャッシュ |
| 打刻レート制限 | 同一ユーザーの連続打刻防止（1分間隔制限） |
| 通知キュー | 打刻漏れ・申請通知の非同期処理キュー |
| 月次集計キャッシュ | ダッシュボードの重い集計クエリ結果をキャッシュ（TTL: 5分） |

---

## 5. インフラ構成

### Phase 1（無料枠）

| レイヤー | サービス | プラン | 制限・注意点 |
|---|---|---|---|
| フロントエンド | Vercel | Hobby（無料） | 商用利用はProプラン推奨（月$20） |
| バックエンド | Render Web Service | Free（無料） | 15分無操作でスリープ。初回リクエスト30秒遅延あり |
| データベース | Render PostgreSQL | Free（無料） | 1GB上限・90日後に削除 |
| キャッシュ | Upstash Redis | Free（無料） | 10,000リクエスト/日・256MB上限 |
| メール | Resend | Free（無料） | 3,000通/月 |
| ファイル | Cloudflare R2 | Free（無料） | 10GB/月 |
| CI/CD | GitHub Actions | Free（無料） | 2,000分/月 |

### Phase 2（AWS本番）

| レイヤー | AWSサービス | 役割 | 移行元 |
|---|---|---|---|
| CDN / DNS | CloudFront + Route 53 | エッジキャッシュ・カスタムドメイン | Vercel |
| バックエンドAPI | App Runner | コンテナ自動スケーリング | Render Web Service |
| データベース | RDS PostgreSQL（Multi-AZ） | 高可用性・自動バックアップ | Render PostgreSQL |
| キャッシュ | ElastiCache（Redis） | セッション・クエリキャッシュ | Upstash Redis |
| セキュリティ | WAF + Shield | DDoS防御 | —（新規追加） |
| 監視・ログ | CloudWatch + X-Ray | メトリクス・分散トレーシング | —（新規追加） |

---

## 6. Phase 1 → Phase 2 移行ロードマップ

| 順序 | 作業 | 難易度 | ダウンタイム |
|---|---|---|---|
| 1 | ドメイン取得 → Route 53 + CloudFront設定 | 低 | なし |
| 2 | Render DB → RDS へ pg_dump で移行 | 中 | メンテナンス30分程度 |
| 3 | APIをDockerコンテナ化 → App Runnerへデプロイ | 中 | Blue/Greenで無停止 |
| 4 | Upstash Redis → ElastiCacheへ接続文字列変更 | 低 | なし |
| 5 | Cloudflare R2 → S3へデータ移行 | 低 | なし |
| 6 | Resend → SES へSMTP設定変更 | 低 | なし |
| 7 | Vercel → CloudFront + S3へ移行 | 中 | DNS切替で数分 |
| 8 | WAF・CloudWatch・Sentryの設定 | 中 | なし |
