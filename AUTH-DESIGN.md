# AUTH-DESIGN.md — 認証・マルチテナント・RLS設計

## 認証方式

| 項目 | 採用方式 |
|------|---------|
| 認証ライブラリ | Better Auth（セルフホスト） |
| セッション方式 | Cookie（HttpOnly + Secure + SameSite=Lax） |
| セッションストア | Upstash Redis（TTL: 7日） |
| テナント分離 | PostgreSQL RLS（行レベルセキュリティ） |
| テナント識別 | セッション内のtenant_idをRLSコンテキストに注入 |

## ロール定義

| 値 | 説明 |
|---|---|
| `super_admin` | サービス提供側のみ。全テナントを横断管理 |
| `admin` | テナント管理者。テナント内の全操作 |
| `manager` | チームリーダー。担当チームの勤怠確認・承認・シフト作成 |
| `employee` | 一般従業員。自身の打刻・申請・シフト確認のみ |

## 認証フロー

```
POST /auth/sign-in
  → Better Auth（credentials検証）
  → core.users からユーザー取得（tenant_id・role含む）
  → Redis に session:{id} = { userId, tenantId, role } を保存（TTL: 7日）
  → Set-Cookie: session（HttpOnly + Secure + SameSite=Lax）

認証済みAPIリクエスト
  → verifySession ミドルウェア（RedisからセッションデータをGET）
  → injectTenantContext ミドルウェア（SET app.tenant_id をDBに実行）
  → RLS自動適用（appスキーマのクエリに自動フィルタ）
  → requireRole ミドルウェア（ロールチェック）
  → ハンドラー実行
```

## サインアップフロー（テナント新規作成）

`POST /auth/sign-up` は `core.tenants`（テナント作成）と `core.users` + `auth.user`/`auth.account`（管理者ユーザー作成）という複数テーブルへの書き込みを伴うため、Better Authの標準 `signUpEmail` には委譲せず、`apps/api/src/routes/auth/sign-up.ts` に自前のハンドラーを実装する（`apps/api/src/routes/users/index.ts` の招待フロー実装と同じパターン）。

```
POST /auth/sign-up { company_name, name, email, password, plan }
  → Zodスキーマでバリデーション（role等は受け付けない。DTOに存在しないため構造的に無視される）
  → hashPassword（better-auth/crypto）
  → db.transaction:
      1. core.tenants へ INSERT（company_name, plan）
      2. auth.user へ INSERT（emailVerified: false）
      3. auth.account へ INSERT（providerId: 'credential', 生成したpasswordハッシュ）
      4. core.users へ INSERT（tenantId, role: 'admin' を常にハードコード、リクエストのroleは参照しない）
  → Better Auth のセッション発行ユーティリティで session_token を生成 + Set-Cookie
  → { user, tenant, session_token } を返す
```

`role='admin'` はハンドラー内でハードコードするため、クライアントが `role` を含めて送信しても到達せず無視される。トランザクション制御・パスワードハッシュ化以外の責務（メール確認トークン発行等）はBetter Auth標準機能（`emailVerification`）にそのまま委譲する。

## RLSポリシー

appスキーマの全テーブルに以下のポリシーが設定されています。

```sql
ALTER TABLE app.time_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.time_records
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

`set_config` の第3引数 `true` はトランザクションローカルを意味します。
トランザクション終了時に自動リセットされるため、コネクションプールでの汚染を防ぎます。

## injectTenantContext ミドルウェア

```typescript
// apps/api/src/middleware/tenant.ts
export const injectTenantContext = createMiddleware(async (c, next) => {
  const tenantId = c.get('tenantId')
  if (!tenantId) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)

  await db.execute(
    sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`
  )
  await next()
})
```

## requireRole ミドルウェア

```typescript
// apps/api/src/middleware/rbac.ts
export const requireRole = (...roles: Role[]) =>
  createMiddleware(async (c, next) => {
    const role = c.get('role')
    if (!roles.includes(role)) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
    }
    await next()
  })

// 使用例
app.get('/api/v1/reports', requireRole('admin', 'manager'), handler)
app.post('/api/v1/work-types', requireRole('admin'), handler)
```
