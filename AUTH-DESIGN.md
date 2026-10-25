# AUTH-DESIGN.md — 認証・マルチテナント・RLS設計

> 2026-09-28更新: 認証ライブラリをBetter Auth（セルフホスト）からSupabase Auth（マネージド）に変更。理由はパスワードハッシュの保管・漏洩リスクやメール確認/パスワードリセットフローの運用負担を自社で持たないため。DB（Neon PostgreSQL + Cloudflare Hyperdrive）・API（Hono on Cloudflare Workers）のアーキテクチャは変更しない。

## 認証方式

| 項目 | 採用方式 |
|------|---------|
| 認証ライブラリ | Supabase Auth（マネージド） |
| セッション方式 | JWT（Authorization: Bearer ヘッダー）。Cookieは使わない |
| セッションストア | 不要（JWTはステートレス検証のためRedis/DB参照なし） |
| テナント分離 | PostgreSQL RLS（行レベルセキュリティ） |
| テナント識別 | JWTの`sub`（Supabase user id）から`core.users`を引いてtenant_idを取得し、RLSコンテキストに注入 |

**Cookie→Bearerトークンに変更する理由**: `apps/api`（Hono on Cloudflare Workers）と`apps/web`（Next.js）は別オリジンのサービスであり、これまでlocalhost/127.0.0.1のSameSite不一致でCookie連携が壊れる問題を抱えていた（ローカル開発の`NEXT_PUBLIC_API_URL`をlocalhost固定にする対処療法で回避していた）。Bearerトークン方式に変えることでこのクラスの問題自体がなくなる。

## ロール定義

| 値 | 説明 |
|---|---|
| `super_admin` | サービス提供側のみ。全テナントを横断管理 |
| `admin` | テナント管理者。テナント内の全操作 |
| `manager` | チームリーダー。担当チームの勤怠確認・承認・シフト作成 |
| `employee` | 一般従業員。自身の打刻・申請・シフト確認のみ |

ロールはSupabase Auth側ではなく、引き続き自社DBの`core.users.role`で管理する（Supabase Authが持つのはID・メール・パスワードなどの認証情報のみ）。

## 認証フロー

```
サインイン（フロントエンド → Supabase Auth、apps/apiを経由しない）
  → フロントエンドが Supabase クライアントSDK で
     supabase.auth.signInWithPassword({ email, password }) を直接呼び出す
  → Supabase Authが検証し、access_token（JWT）・refresh_token を返す
  → フロントエンドはSDKの管理下でトークンを保持し、
     apps/api への各リクエストに Authorization: Bearer <access_token> を付与する

認証済みAPIリクエスト（apps/api側）
  → verifySession ミドルウェア（SupabaseのJWKSエンドポイントで署名検証、有効期限チェック）
  → JWTのsubからcore.usersを検索し、tenantId・role・isActiveを取得
  → injectTenantContext ミドルウェア（以降の処理をテナント用トランザクションで包む。
     トランザクション内で SET LOCAL ROLE kintai_app と app.tenant_id の設定を行う）
  → RLS自動適用（appスキーマのクエリに自動フィルタ）
  → requireRole ミドルウェア（ロールチェック）
  → ハンドラー実行
```

`GET /auth/me`は引き続きapps/api側のカスタムハンドラーとして残し、`core.users`のtenantId/role/isActiveを返す（サインイン直後にフロントエンドがテナント・ロール情報を取得するために呼ぶ）。

## サインアップフロー（テナント新規作成）

`POST /auth/sign-up`は`core.tenants`（テナント作成）と`core.users`という複数テーブルへの書き込みを伴い、かつ`role='admin'`をサーバー側で強制する必要があるため、Supabase Authの標準サインアップ（フロントエンドから直接`supabase.auth.signUp()`を呼ぶ方式）には委譲せず、引き続き`apps/api/src/routes/auth/sign-up.ts`に自前のハンドラーを実装する。

```
POST /auth/sign-up { company_name, name, email, password, plan }
  → Zodスキーマでバリデーション（role等は受け付けない。DTOに存在しないため構造的に無視される）
  → Supabase Admin API（service_role key）で supabase.auth.admin.createUser({ email, password, email_confirm: false }) を呼び、Supabase側にユーザーを作成
  → db.transaction:
      1. core.tenants へ INSERT（company_name, plan）
      2. core.users へ INSERT（tenantId, authUserId: Supabase側で発行されたuser.id, role: 'admin' を常にハードコード、リクエストのroleは参照しない）
  → { user, tenant } を返す（フロントエンドはこの後 signInWithPassword で改めてサインインしトークンを取得する）
```

`role='admin'`はハンドラー内でハードコードするため、クライアントが`role`を含めて送信しても到達せず無視される。

**トランザクション境界の注意点**: Supabase側のユーザー作成（Admin API呼び出し）と自社DBの`core.tenants`/`core.users`作成は、物理的に別システムへの書き込みのため単一のDBトランザクションで両方をアトミックに扱うことはできない。`core.tenants`/`core.users`のINSERTが失敗した場合は、直前に作成したSupabase側のユーザーを`supabase.auth.admin.deleteUser()`で削除する補償処理をハンドラー内に実装する。

## 招待フロー（既存テナントへのユーザー追加）

`apps/api/src/routes/users/index.ts`の`initialPassword`をハンドラー側で発行する現行方式は廃止する。管理者がユーザーを追加する際は、Supabase Admin APIの`supabase.auth.admin.inviteUserByEmail()`（招待メール送信、本人がリンクからパスワード設定）を使用する。招待メールの送信元はSupabase Auth側のカスタムSMTP設定（Resend）経由。

## メール確認・パスワードリセット

Supabase Auth標準機能に委譲する。送信元メールはSupabase側のカスタムSMTP設定でResendを指定する（`apps/api/src/lib/auth.ts`にあった`sendVerificationEmail`コールバックの自前実装は不要になる）。

Supabase Authのメール確認リンクはPKCE方式（`?code=...`をフロントエンドの指定コールバックURLへ返し、`supabase.auth.exchangeCodeForSession()`で確定する）が既定であり、Better Authの「サーバー側で検証してからリダイレクト」方式とは遷移の仕組みが異なる。この差分は`docs/screens/verify-email-design.md`の作り替えが別途必要（本ファイルの更新だけでは反映されない。要フォローアップ）。

## RLSポリシー

tenant_id列を持つappスキーマの全テーブルに、以下のポリシーを設定しています（マイグレーション `0004` で作成）。

```sql
ALTER TABLE app.time_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.time_records
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

- `app.tenant_id` が未設定のときは条件がNULLになり、1行も返らない（エラーにはしない）
  - RLSはアプリ側の `WHERE tenant_id` が漏れたときの保険なので、DB側は「漏らさない」方向に倒れれば十分（fail-closed）
  - `current_setting` は、そのセッションで一度も設定されていなければ `NULL`、プール内で過去に `set_config(..., true)` されたコネクションでは `''` を返す。DB側でエラーにしようとするとコネクションの状態で挙動が変わるため、`NULLIF` で両方を `NULL` に揃えている
  - その代わり、呼び出し側のバグ（tenantIdの渡し忘れ・空文字など）は `withTenantTransaction` の入口でtenantIdがUUID形式かを検証し、アプリ側の例外として検知する
- `WITH CHECK` により、他テナントの `tenant_id` を指定したINSERT/UPDATEも拒否される
- `billing_summaries`・`billing_contract_members`・`request_approvals` は本来親テーブル経由でテナントが決まるが、RLSで直接判定できるよう `tenant_id` を複製して持つ

### RLSを回避させないためのロール切り替え

スーパーユーザー（ローカルのDocker）とテーブル所有者（Neon）はRLSを無視するため、接続ユーザーのままではポリシーが効かない。
そこでマイグレーションでログイン不可のロール `kintai_app` を作成し、テナント用トランザクションの開始時に `SET LOCAL ROLE kintai_app` で切り替える。

- `kintai_app` は所有者ではないためRLSが必ず適用される
- 権限は app・core スキーマのテーブルの SELECT/INSERT/UPDATE/DELETE。ただし `audit_logs` は SELECT/INSERT のみ（UPDATE/DELETE禁止をDB側でも強制）
- `SET LOCAL` はトランザクション終了で元に戻るため、コネクションプールで他のリクエストに引き継がれない
- マイグレーション・シードは接続ユーザーのまま実行するため、RLSの影響を受けない

**補足（Supabase Auth採用後も変わらない理由）**: SupabaseにはRLSポリシー内で`auth.uid()`を直接参照できる仕組みがあるが、これは自社Postgres（Neon）+ PostgRESTを経由しないHono/Drizzleの直接接続では機能しない（`auth.uid()`はPostgRESTがリクエストごとに`request.jwt.claims`をセッション変数へ注入する前提の関数のため）。そのため`injectTenantContext`による`set_config('app.tenant_id', ...)`の手動注入方式は今後も維持する。

## injectTenantContext ミドルウェア

`set_config` の第3引数 `true`（トランザクションローカル）は、トランザクションの外で実行すると文の終了と同時に消える。
そのため、リクエストの残りの処理をまるごと1つのトランザクションで包み、その中で設定する。

```typescript
// apps/api/src/middleware/auth.ts
export const injectTenantContext = createMiddleware<AppEnv>(async (c, next) => {
  const tenantId = c.get('tenantId')
  if (!tenantId) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)

  try {
    await withTenantTransaction(tenantId, async (tx) => {
      await next()
      if (c.error) tx.rollback() // ハンドラーで例外が起きたら書き込みを取り消す
    })
  } catch (err) {
    if (!(err instanceof TransactionRollbackError)) throw err
  }
})
```

```typescript
// apps/api/src/db/index.ts
export function withTenantTransaction<T>(tenantId: string, fn: (tx: Tx) => Promise<T>) {
  return requireDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE kintai_app`)
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`)
    return tenantTxStorage.run(tx, () => fn(tx))
  })
}
```

- `db`（Proxy）は AsyncLocalStorage に保持したトランザクションに解決されるため、クエリ側のコードは `db.select()` 等のままでよい
- クエリ内の `db.transaction()` は、このトランザクションの中でsavepointとして動く
- `injectTenantContext` を通らない処理（サインアップ、Stripe Webhook、`verifySession` 内のユーザー検索）は接続ユーザーのまま実行される。これらは core スキーマ（RLS対象外）だけを扱う

## verifySession ミドルウェア（変更）

```typescript
// apps/api/src/middleware/auth.ts
export const verifySession = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)

  // SupabaseのJWKSエンドポイント（/auth/v1/.well-known/jwks.json）から公開鍵を取得して署名・有効期限を検証。
  // 2025-10-1以降作成のプロジェクトはES256(非対称鍵)がデフォルトのため、固定のHS256共有シークレットは使わない
  const payload = await verifySupabaseJwt(token)
  if (!payload) return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)

  const coreUser = await findUserByAuthUserId(payload.sub)
  if (!coreUser || !coreUser.isActive) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }
  if (!isValidRole(coreUser.role)) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
  }

  c.set('userId', coreUser.id)
  c.set('tenantId', coreUser.tenantId)
  c.set('role', coreUser.role)
  await next()
})
```

`findUserById(session.user.id)`（Better Auth）は`findUserByAuthUserId(payload.sub)`に置き換わる。`core.users`にSupabase側のuser idを保持する`auth_user_id`カラムが必要（DBスキーマ変更。詳細は`docs/db-design.md`側で追記予定）。

## requireRole ミドルウェア

```typescript
// apps/api/src/middleware/rbac.ts（変更なし）
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

## Better Authからの移行に伴う実装変更まとめ

| 対象 | 変更内容 |
|---|---|
| `apps/api/src/lib/auth.ts` | Better Auth初期化を削除。Supabase Admin Client（service_role key）の初期化に置き換え |
| `apps/api/src/db/schema/auth.ts` | `authUser`/`authSession`/`authAccount`/`authVerification`のDrizzle定義を削除（Supabaseが`auth`スキーマを自前管理） |
| `apps/api/src/db/schema/core.ts` | `core.users`に`auth_user_id`（Supabase user idを保持する列）を追加 |
| `apps/api/src/middleware/auth.ts` | `verifySession`をJWT検証ベースに書き換え（上記参照） |
| `apps/api/src/routes/auth/index.ts` | `app.on(['POST','GET'], '/auth/*', (c) => auth.handler(c.req.raw))`によるBetter Authへの委譲ルートを削除。`/auth/sign-up`・`/auth/me`のみ自前ハンドラーとして残す |
| `apps/api/src/routes/users/index.ts` | `initialPassword`発行方式を廃止し、Supabase Admin APIの招待機能に置き換え |
| `apps/api/src/middleware/rate-limit.ts` | 変更なし（Upstash Redisはレート制限用途としては継続使用） |
| 環境変数 | `BETTER_AUTH_SECRET`・`BETTER_AUTH_URL`を削除。`SUPABASE_URL`・`SUPABASE_ANON_KEY`・`SUPABASE_SERVICE_ROLE_KEY`を追加（JWT検証はJWKSエンドポイントを使うため専用の環境変数は不要。詳細は`TECH-STACK.md`） |
| `apps/web` | Supabaseクライアント（`@supabase/supabase-js`または`@supabase/ssr`）を導入し、サインイン・トークン保持・自動リフレッシュを実装。APIへのリクエストに`Authorization: Bearer`を付与するfetchラッパーが必要 |
| `docs/screens/verify-email-design.md` | Better Authの「サーバー検証→リダイレクト」前提で書かれた画面設計を、Supabase AuthのPKCEコールバック方式に合わせて作り直す必要あり（要フォローアップ） |
| `docs/screens/signup-page-design.md`・`docs/screens/top-page-design.md` | `session_token`のレスポンス形式や「Better Auth経由」という記述の軽微な修正が必要（要フォローアップ） |
