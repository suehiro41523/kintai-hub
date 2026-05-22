# ARCHITECTURE.md — システム構成・DB設計

## モノレポ構成

```
/
├── apps/
│   ├── web/          # Next.js 15 フロントエンド（Vercel）
│   └── api/          # Hono.js バックエンドAPI（Render / App Runner）
├── packages/
│   ├── types/        # Zod スキーマ・TypeScript型定義（フロント・バック共通）
│   ├── ui/           # shadcn/ui ベースの共通UIコンポーネント
│   └── config/       # ESLint・TypeScript・Tailwindの共通設定
├── CLAUDE.md
├── ARCHITECTURE.md   # このファイル
├── package.json      # yarn workspaces 設定
└── docker-compose.yml
```

## DBスキーマ構成

**2スキーマ構成**を採用しています。

- `core` — tenants / users / departments（認証・RLSの起点）
- `app`  — それ以外の11テーブル（勤怠管理サービスの全業務機能）

coreスキーマを分離している理由：全テーブルの認証・RLS起点となるため、
スキーマ単位でINSERT/UPDATE権限を厳密に管理するためです。

## テーブル一覧

```
core.tenants                  # SaaS契約企業のマスタ
core.users                    # 従業員・管理者
core.departments              # 部署（自己参照で階層構造）

app.work_types                # ワークタイプ定義 ★差別化機能
app.time_records              # 打刻記録（work_type_idと紐付け）★差別化機能
app.shift_patterns            # シフトパターン雛形
app.shifts                    # 従業員別日次シフト
app.requests                  # 申請（有給・残業・打刻修正等）
app.request_approvals         # 承認フロー（最大3ステップ）
app.billing_contracts         # 精算契約 ★差別化機能
app.billing_contract_members  # 契約メンバーアサイン
app.billing_summaries         # 月次精算集計 ★差別化機能
app.notifications             # 通知
app.audit_logs                # 操作ログ（INSERT専用・5年保管）
```

## 全テーブル共通ルール

- 主キーは `UUID`
- 日時カラムは `TIMESTAMPTZ`（タイムゾーン付き）
- appスキーマの全テーブルは `tenant_id UUID NOT NULL` を持つ
- RLSポリシーは全appスキーマテーブルに適用済み

## Drizzle ORM スキーマファイルの配置

```
apps/api/src/db/
  schema/
    core.ts    # core スキーマのテーブル定義
    app.ts     # app スキーマのテーブル定義
  index.ts     # db インスタンスのエクスポート
  migrate.ts   # マイグレーション実行スクリプト
```
