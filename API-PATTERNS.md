# API-PATTERNS.md — APIハンドラーの実装パターン

## 基本パターン

```typescript
// apps/api/src/routes/time-records/clock-in.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ClockInSchema } from '@kintai/types'
import { verifySession, injectTenantContext, requireRole } from '../../middleware'

export const clockInRoute = new Hono()
  .post(
    '/',
    verifySession,
    injectTenantContext,
    zValidator('json', ClockInSchema),
    async (c) => {
      const { workTypeId, locationLat, locationLng } = c.req.valid('json')
      const userId   = c.get('userId')
      const tenantId = c.get('tenantId')

      // ビジネスロジック
      // ...

      return c.json({ record }, 201)
    }
  )
```

## ミドルウェアの適用順序

```typescript
// 認証が必要なルートは必ずこの順序で適用
verifySession        // セッション検証・userId/tenantId/roleをコンテキストにセット
injectTenantContext  // SET app.tenant_id をDBに実行（RLS有効化）
requireRole(...)     // ロールチェック（必要な場合のみ）
zValidator(...)      // リクエストバリデーション
```

## エラーレスポンスの形式

**必ずこの形式に統一すること：**

```typescript
// 成功
return c.json({ record }, 201)
return c.json({ records, total, page }, 200)

// エラー
return c.json({
  error: 'ユーザーが見つかりません',
  code: 'NOT_FOUND',
}, 404)

// バリデーションエラー（Zodが自動生成）
return c.json({
  error: 'バリデーションエラー',
  code: 'VALIDATION_ERROR',
  details: [{ field: 'workTypeId', message: 'Required' }]
}, 400)
```

## よく使うエラーコード

| コード | ステータス |
|--------|-----------|
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `VALIDATION_ERROR` | 400 |
| `ALREADY_CLOCKED_IN` | 400 |
| `NOT_CLOCKED_IN` | 400 |
| `CONFLICT` | 409 |
| `RATE_LIMITED` | 429 |

## ページネーションの形式

```typescript
// リクエスト
GET /api/v1/time-records?page=1&limit=20

// レスポンス
{
  records: [...],
  total: 100,
  page: 1,
  limit: 20,
  totalPages: 5
}
```

## ルートのファイル構成

```
apps/api/src/
  routes/
    auth/
      index.ts
    time-records/
      index.ts         # ルートの集約
      clock-in.ts
      clock-out.ts
      switch-type.ts
    work-types/
      index.ts
    billing/
      index.ts
      calculate.ts
  middleware/
    auth.ts            # verifySession
    tenant.ts          # injectTenantContext
    rbac.ts            # requireRole
  index.ts             # アプリのエントリポイント
```
