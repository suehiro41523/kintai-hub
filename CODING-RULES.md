# CODING-RULES.md — コーディング規約

## 命名規則

| 対象 | 規則 | 例 |
|------|------|---|
| ファイル名 | kebab-case | `clock-in.ts`, `work-type.ts` |
| 変数・関数 | camelCase | `clockedAt`, `getTenantId` |
| 型・クラス | PascalCase | `ClockInSchema`, `WorkType` |
| DBカラム | snake_case（Drizzleが自動変換） | `tenant_id`, `clocked_at` |
| 環境変数 | UPPER_SNAKE_CASE | `DATABASE_URL` |
| APIルート | kebab-case | `/time-records/clock-in` |

## 禁止事項

- `any` 型（`unknown` を使ってから型ガードで絞ること）
- `console.log` を本番コードに残す
- `SELECT *` をDrizzle ORMで書く（必要なカラムを明示する）
- appスキーマへの生SQL（必ずDrizzle ORM経由）
- `audit_logs` への `UPDATE` / `DELETE`
- appスキーマのクエリで `WHERE tenant_id` を省略する

## インポート順序

```typescript
// 1. Node.js 標準モジュール
import { randomUUID } from 'crypto'

// 2. 外部ライブラリ
import { Hono } from 'hono'
import { z } from 'zod'

// 3. monorepo内パッケージ
import { ClockInSchema } from '@kintai/types'

// 4. 相対パス
import { db } from '../../db'
import { verifySession } from '../../middleware'
```

## コメント規約

- **なぜ**そうするかを書く（何をするかはコードを読めばわかる）
- ビジネスロジック固有の処理には必ずコメントを入れる
- TODO は `// TODO(名前): 内容` 形式

```typescript
// ✅ 良いコメント
// ワークタイプ切替はclock-out→clock-inのトランザクションで実装する
// 途中で失敗すると稼働時間の計算が狂うため

// ❌ 悪いコメント
// ユーザーIDを取得する
const userId = c.get('userId')
```

## Zodスキーマの配置（packages/types）

```
packages/types/src/
  auth.ts          # 認証関連
  user.ts          # ユーザー・テナント
  work-type.ts     # ワークタイプ
  time-record.ts   # 打刻
  shift.ts         # シフト
  request.ts       # 申請
  billing.ts       # 精算・請求
  common.ts        # 共通型（ページネーション・エラー等）
```

フロントとバックで**同じスキーマを共有**します。スキーマは必ず `packages/types` に定義し、各アプリからインポートします。
