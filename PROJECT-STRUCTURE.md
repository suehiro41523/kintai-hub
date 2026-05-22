# PROJECT-STRUCTURE.md — ディレクトリ構成

## 全体構成

```
/
├── apps/
│   ├── web/                    # Next.js 15 フロントエンド
│   └── api/                    # Hono.js バックエンドAPI
├── packages/
│   ├── types/                  # Zod スキーマ・共通型定義
│   ├── ui/                     # 共通UIコンポーネント
│   └── config/                 # 共通設定ファイル
├── docs/                       # 設計書（実装時の参照先）
│   ├── requirements.md         # 要件定義書
│   ├── tech-selection.md       # 技術選定書
│   ├── db-design.md            # DB設計書
│   └── api-spec.md             # API設計書
├── docker-compose.yml
├── package.json                # yarn workspaces 設定
├── CLAUDE.md
├── ARCHITECTURE.md
├── TECH-STACK.md
├── AUTH-DESIGN.md
├── DOMAIN-RULES.md
├── CODING-RULES.md
├── API-PATTERNS.md
├── DB-PATTERNS.md
├── PROJECT-STRUCTURE.md        # このファイル
└── TESTING.md
```

---

## docs/ — 設計書

```
docs/
├── requirements.md     # 要件定義書（機能要件・非機能要件・差別化機能）
├── tech-selection.md   # 技術選定書（技術スタック・Phase1→2移行計画）
├── db-design.md        # DB設計書（全14テーブル定義・インデックス・RLS）
└── api-spec.md         # API設計書（全62エンドポイント仕様）
```

---

## apps/api — バックエンド

```
apps/api/
├── src/
│   ├── index.ts                # エントリポイント・ルートマウント
│   ├── db/
│   │   ├── index.ts
│   │   ├── migrate.ts
│   │   └── schema/
│   │       ├── core.ts         # core スキーマ（tenants / users / departments）
│   │       └── app.ts          # app スキーマ（work_types / time_records 等）
│   ├── middleware/
│   │   ├── auth.ts             # verifySession
│   │   ├── tenant.ts           # injectTenantContext
│   │   └── rbac.ts             # requireRole
│   ├── routes/
│   │   ├── auth/index.ts
│   │   ├── users/
│   │   ├── departments/
│   │   ├── work-types/
│   │   ├── time-records/
│   │   │   ├── index.ts
│   │   │   ├── clock-in.ts
│   │   │   ├── clock-out.ts
│   │   │   ├── switch-type.ts  # ワークタイプ切替（差別化機能）
│   │   │   └── summary.ts
│   │   ├── shifts/
│   │   ├── requests/
│   │   ├── billing/
│   │   │   ├── calculate.ts    # 精算計算ロジック（差別化機能）
│   │   │   └── invoice.ts
│   │   ├── reports/
│   │   └── notifications/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── redis.ts
│   │   ├── storage.ts
│   │   └── mailer.ts
│   └── test/
│       ├── helpers.ts          # createTestContext
│       └── setup.ts
├── drizzle/migrations/
├── .env
├── .env.example
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## apps/web — フロントエンド

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       ├── page.tsx              # 管理者ダッシュボード
│   │       ├── clock/page.tsx        # 打刻画面（差別化機能）
│   │       ├── shifts/page.tsx
│   │       ├── requests/page.tsx
│   │       ├── reports/
│   │       │   ├── page.tsx
│   │       │   └── work-type/page.tsx  # 種別別レポート（差別化機能）
│   │       ├── billing/page.tsx        # 精算・請求（差別化機能）
│   │       └── settings/
│   │           ├── users/page.tsx
│   │           └── work-types/page.tsx
│   ├── components/
│   │   ├── clock/
│   │   │   ├── WorkTypeSelector.tsx
│   │   │   ├── ClockButton.tsx
│   │   │   └── DailySummary.tsx
│   │   └── dashboard/
│   ├── hooks/
│   │   ├── use-clock.ts
│   │   ├── use-session.ts
│   │   └── use-work-types.ts
│   ├── lib/
│   │   ├── api-client.ts
│   │   └── auth-client.ts
│   └── providers/QueryProvider.tsx
├── .env.local
├── next.config.ts
├── package.json
└── tailwind.config.ts
```

---

## packages/types — 共通型定義

```
packages/types/src/
  auth.ts / user.ts / work-type.ts / time-record.ts
  shift.ts / request.ts / billing.ts / common.ts
```
