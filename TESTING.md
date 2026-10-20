# TESTING.md — テスト規約

## テストの実行（apps/api）

```bash
docker compose up -d        # PostgreSQLを起動
npm run test -w @kintai/api
```

- テストは開発用DB（`kintai_hub`）とは別の `kintai_hub_test` を使う。初回実行時に自動で作成され、毎回マイグレーションが最新まで適用される（`src/test/global-setup.ts`）
- 接続先は `TEST_DATABASE_URL` で変更できる。誤って開発用・本番用DBに書き込まないよう、DB名が `_test` で終わらないとエラーになる
- Supabase Authには接続しない。`src/test/setup.ts` で `verifyAccessToken` をモックしており、`core.users.auth_user_id` の値をそのままBearerトークンに指定すると、そのユーザーとして認証される
- テストデータは `createTestTenant()`（`src/test/helpers.ts`）でテストごとに新しいテナントを作って分離する。admin・manager・employeeの3ユーザーと、精算契約・下書きサマリーを1件ずつ持つ

## テストファイルの配置

ソースファイルと同じディレクトリに `.test.ts` で配置します。

```
apps/api/src/routes/time-records/
  clock-in.ts
  clock-in.test.ts
```

## マルチテナントのテストパターン

```typescript
import { createTestContext } from '../../test/helpers'

describe('POST /api/v1/time-records/clock-in', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await createTestContext()
  })

  it('ワークタイプを指定して出勤打刻できる', async () => {
    const res = await ctx.api.post('/api/v1/time-records/clock-in', {
      workTypeId: ctx.workTypes.officeWork.id,
    })
    expect(res.status).toBe(201)
    expect(res.body.record.workTypeId).toBe(ctx.workTypes.officeWork.id)
  })

  it('既に出勤中の場合は400を返す', async () => {
    await ctx.clockIn()
    const res = await ctx.api.post('/api/v1/time-records/clock-in', {
      workTypeId: ctx.workTypes.officeWork.id,
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ALREADY_CLOCKED_IN')
  })

  it('別テナントのワークタイプは使用できない', async () => {
    const otherCtx = await createTestContext()
    const res = await ctx.api.post('/api/v1/time-records/clock-in', {
      workTypeId: otherCtx.workTypes.officeWork.id,
    })
    expect(res.status).toBe(404)
  })
})
```

## createTestContext の仕様

```typescript
// apps/api/src/test/helpers.ts
export async function createTestContext(): Promise<TestContext> {
  // テナント作成
  // 管理者ユーザー作成
  // デフォルトワークタイプ作成（officeWork, clientA, clientB）
  // セッションCookieをセット
  // apiクライアントを返す
}
```

## テストの種類と方針

| 種類 | 対象 | 方針 |
|------|------|------|
| ユニットテスト | 精算ロジック・バリデーション | 関数単位で網羅的にテスト |
| インテグレーションテスト | APIハンドラー | DBありでエンドツーエンドに近い形でテスト |
| RLSテスト | テナント分離 | 必ず別テナントのデータが見えないことを確認 |

## 精算ロジックのテスト例

```typescript
import { calculateBilling } from '../billing/calculate'

describe('calculateBilling（range方式）', () => {
  const contract = {
    billingType: 'range',
    minHours: 140,
    maxHours: 180,
    baseAmount: 500000,
    overRate: 3500,
    underRate: 3000,
  }

  it('上限超過の場合は超過分を加算する', () => {
    const result = calculateBilling(contract, 172)
    expect(result.billingAmount).toBe(500000)
  })

  it('下限不足の場合は不足分を減算する', () => {
    const result = calculateBilling(contract, 120)
    // 140 - 120 = 20h 不足 → 500000 - 20 × 3000 = 440000
    expect(result.billingAmount).toBe(440000)
  })
})
```
