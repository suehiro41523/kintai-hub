# KintaiHub

SES業界向けクラウド型勤怠管理SaaS。
ワークタイプ（作業種別）連動の打刻・精算が最大の差別化機能。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 (App Router) / TypeScript / Tailwind CSS / TanStack Query |
| バックエンド | Hono.js / TypeScript / Drizzle ORM |
| DB | PostgreSQL 16 |
| キャッシュ | Redis 7 |
| パッケージ管理 | yarn 4 (workspaces) |

## ローカル開発環境のセットアップ

### 前提条件

- [Node.js 22+](https://nodejs.org/) (Volta 推奨)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [yarn 4](https://yarnpkg.com/)

### 手順

**1. 依存パッケージのインストール**

```bash
yarn install
```

**2. Docker でミドルウェアを起動**

Docker Desktop を起動してから実行してください。

```bash
docker compose up -d
```

PostgreSQL（ポート 5432）と Redis（ポート 6379）が起動します。

**3. 環境変数の設定**

`apps/api/.env` はリポジトリに含まれていません。以下の内容で作成してください。

```bash
# apps/api/.env
DATABASE_URL=postgresql://kintai:kintai_pass@localhost:5432/kintai_hub
```

**4. DBマイグレーションの適用**

```bash
yarn workspace @kintai/api db:migrate
```

`Migration complete` と表示されれば成功です。

**5. 開発サーバーの起動**

```bash
# API（ポート 3001）とフロントエンド（ポート 3000）を同時起動
yarn dev

# 個別に起動する場合
yarn dev:api   # APIのみ
yarn dev:web   # フロントエンドのみ
```

ブラウザで http://localhost:3000 を開いてください。

## DB 操作コマンド

```bash
# スキーマ変更後に SQL ファイルを再生成
yarn workspace @kintai/api db:generate

# マイグレーションを適用
yarn workspace @kintai/api db:migrate

# Drizzle Studio（ブラウザでDBの中身を確認）
yarn workspace @kintai/api db:studio
```

## コード品質

```bash
# フォーマット・lint・import整列を一括実行
yarn check
```

## プロジェクト構成

```
/
├── apps/
│   ├── api/          # Hono.js バックエンドAPI（ポート 3001）
│   └── web/          # Next.js フロントエンド（ポート 3000）
├── packages/         # 共通パッケージ（型定義・UIコンポーネント等）
├── docker-compose.yml
└── README.md
```

詳細な設計・実装ガイドは各 `.md` ファイルを参照してください。

| ファイル | 内容 |
|---|---|
| `ARCHITECTURE.md` | システム構成・DB設計 |
| `DOMAIN-RULES.md` | ビジネスロジック・精算ルール |
| `API-PATTERNS.md` | APIハンドラーパターン |
| `CODING-RULES.md` | 命名規則・禁止事項 |
| `docs/db-design.md` | 全テーブル定義 |
| `docs/api-spec.md` | 全エンドポイント仕様 |
