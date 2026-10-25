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

APIのインテグレーションテストは、ルートのディレクトリごとに `<ディレクトリ名>.test.ts` を1つ置きます。DB層のテスト（RLSなど）は `src/db/` に置きます。

```
apps/api/src/routes/time-records/
  clock-in.ts
  break-start.ts
  patch.ts
  time-records.test.ts
apps/api/src/db/
  rls.test.ts
```

## マルチテナントのテストパターン

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { apiRequest, createTestTenant, type TestTenant } from '../../test/helpers.js'

describe('POST /time-records/clock-in', () => {
  let tenant: TestTenant
  let otherTenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
    otherTenant = await createTestTenant()
  })

  it('ワークタイプを指定して出勤打刻できる', async () => {
    const res = await apiRequest('/time-records/clock-in', {
      token: tenant.users.employee.token,
      method: 'POST',
      body: { workTypeId: tenant.workTypeId },
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { record: { workTypeId: string } }
    expect(body.record.workTypeId).toBe(tenant.workTypeId)
  })

  it('別テナントのワークタイプは使用できない', async () => {
    const res = await apiRequest('/time-records/clock-in', {
      token: tenant.users.employee.token,
      method: 'POST',
      body: { workTypeId: otherTenant.workTypeId },
    })

    expect(res.status).toBe(404)
  })
})
```

- レスポンスは標準の `Response`。ボディは `await res.json()` で取り出し、`as` で期待する型を付ける
- DBの状態を確認したいときは、テストから `db`（`src/db/index.ts`）で直接SELECTする。テストからのクエリはテナント用トランザクションの外で、接続ユーザー（スーパーユーザー）のまま実行されるため、RLSの影響を受けない
- 別テナントのデータが絡むテストは、`createTestTenant()` をもう1回呼んで別テナントを作る

## テストヘルパー（`src/test/helpers.ts`）

### `createTestTenant(): Promise<TestTenant>`

呼ぶたびに独立したテナントを1つ作り、次のデータを登録します。テスト間でデータを共有しないため、テスト後の削除は行いません。

| データ | 内容 | 戻り値での参照 |
|---|---|---|
| テナント | `plan: 'free'`、`status: 'active'` | `tenantId` |
| ユーザー | admin・manager・employee の3人 | `users.admin` / `users.manager` / `users.employee`（それぞれ `{ id, token }`） |
| ワークタイプ | 「客先常駐」（`billingType: 'hourly'`） | `workTypeId` |
| 精算契約 | 上記ワークタイプの時間単価契約（`TEST_YEAR`年1月1日開始） | `contractId` |
| 精算サマリー | 上記契約の `TEST_YEAR`年`TEST_MONTH`月分、`status: 'draft'` | `summaryId` |

`TEST_YEAR`（2026）・`TEST_MONTH`（9）も `helpers.ts` から export しています。

### `apiRequest(path, { token, method?, body? }): Promise<Response>`

Honoの `app.request()` でAPIを呼びます。HTTPサーバーは起動しません。

- `path` は `/api/v1` を除いたパス（例：`/billing/contracts`）
- `token` は `Authorization: Bearer <token>` に入る。`users.admin.token` などを渡す
- `method` は省略時 `GET`。`body` を渡すとJSONに変換し、`Content-Type: application/json` を付ける

### 認証のモック（`src/test/setup.ts`）

Supabase Authには接続しません。`verifyAccessToken` をモックし、受け取ったトークン文字列をそのままSupabaseのユーザーID（`sub`）として扱います。
`createTestTenant()` が作るユーザーは `token` と `core.users.auth_user_id` が同じ値なので、`token` を渡すとそのユーザーとして認証されます。

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
