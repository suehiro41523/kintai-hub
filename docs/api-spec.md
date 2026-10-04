# api-spec.md — API設計書

> Base URL: `/api/v1` / 認証: Authorization: Bearer（Supabase Auth発行のJWT）/ Content-Type: `application/json`
>
> 2026-09-28更新: 認証ライブラリをBetter AuthからSupabase Authに変更（詳細は`AUTH-DESIGN.md`）。サインイン・サインアウト・パスワードリセット・MFA・メール確認は、apps/apiを経由せずフロントエンドがSupabaseクライアントSDKで直接Supabase Authを呼び出す方式に変わったため、以下の表から該当エンドポイントを削除した。apps/api側に残るのは`/auth/sign-up`（テナント作成を伴うため自前実装）と`/auth/me`（tenantId/role取得）のみ。

---

## 共通仕様

### エラーレスポンス形式

```json
{ "error": "メッセージ", "code": "ERROR_CODE", "details": [...] }
```

### ページネーション

```
リクエスト: ?page=1&limit=20
レスポンス: { data, total, page, limit, totalPages }
```

### その他

| 項目 | 仕様 |
|---|---|
| 日付フォーマット | ISO 8601（UTC）: `2026-05-21T09:00:00Z` |
| ID形式 | UUID v4 |
| レートリミット | 認証エンドポイント: 10req/min、その他: 100req/min |
| テナント分離 | 全リクエストに tenant_id が自動付与（RLS + Honoミドルウェア） |

---

## ドメイン一覧

| ドメイン | EP数 | 主な機能 | 最小ロール |
|---|---|---|---|
| 認証 | 10 | サインイン・アウト・MFA・パスワードリセット・メール確認 | 全員 |
| テナント・ユーザー | 13 | テナント設定・ユーザーCRUD・部署管理 | admin |
| ワークタイプ | 5 | 種別定義・並び替え・無効化 ★差別化機能 | admin |
| 打刻 | 11 | 出退勤・休憩・種別切替・修正・月次集計 ★差別化機能の核心 | employee |
| シフト | 9 | シフト作成・公開・希望収集 | employee |
| 申請・承認 | 8 | 有給・残業・打刻修正・承認ワークフロー | employee |
| 精算・請求 | 11 | 精算契約・月次計算・請求書PDF生成 ★差別化機能 | admin |
| レポート・通知 | 7 | 月次サマリー・36協定・CSVエクスポート・通知 | admin |

---

## 1. 認証 API

### apps/api側に残るエンドポイント

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | /auth/sign-up | 新規テナント登録（Supabase Admin APIでのユーザー作成 + core.tenants/core.users作成を1ハンドラーで実行） | all | name, email, password, company_name, plan | { user, tenant } | 400 / 409 | 不要 |
| 2 | GET | /auth/me | サインイン後のtenantId/role/isActive取得 | all | なし | { user } | 401 | 必須 |

### フロントエンドがSupabaseクライアントSDKで直接呼び出す操作（apps/apiを経由しない）

| 操作 | Supabase Auth SDK呼び出し | 備考 |
|---|---|---|
| ログイン | `supabase.auth.signInWithPassword()` | 成功後、返却された access_token を以後のapps/apiリクエストに`Authorization: Bearer`で付与 |
| ログアウト | `supabase.auth.signOut()` | — |
| パスワードリセットメール送信 | `supabase.auth.resetPasswordForEmail()` | — |
| パスワードリセット実行 | `supabase.auth.updateUser({ password })` | リセットリンク経由のセッションで実行 |
| MFA有効化・検証 | `supabase.auth.mfa.enroll()` / `supabase.auth.mfa.verify()` | — |
| メール確認 | Supabase Authのメール確認リンク（PKCE） | Better Auth標準機能とは遷移の仕組みが異なる。画面設計（`screens/verify-email-design.md`）の作り直しが未着手（要フォローアップ、詳細は`AUTH-DESIGN.md`） |

トークン有効期限はSupabase Authのデフォルト（アクセストークン1時間・リフレッシュトークンは無期限で1回使い切り）。詳細: `AUTH-DESIGN.md`

---

## 2. テナント・ユーザー API

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | /tenants/me | テナント情報取得 | admin | なし | { id, name, plan, status, maxUsers } | 401/403 | 必須 |
| 2 | PATCH | /tenants/me | テナント情報更新 | admin | name?, logoUrl? | { tenant } | 400 | 必須 |
| 3 | GET | /users | ユーザー一覧取得 | admin | ?page&limit&dept&role&active | { users, total, page } | 403 | 必須 |
| 4 | POST | /users | ユーザー招待・作成 | admin | name, email, role, departmentId, employmentType | { user } | 400 / 409 | 必須 |
| 5 | GET | /users/:id | ユーザー詳細取得 | admin | なし | { user } | 404 | 必須 |
| 6 | PATCH | /users/:id | ユーザー情報更新 | admin | name?, role?, departmentId?, isActive? | { user } | 400 / 404 | 必須 |
| 7 | DELETE | /users/:id | ユーザー無効化（論理削除） | admin | なし | { success: true } | 404 | 必須 |
| 8 | GET | /users/me | 自分のプロフィール取得 | all | なし | { user } | 401 | 必須 |
| 9 | PATCH | /users/me | 自分のプロフィール更新 | all | name?, avatarUrl? | { user } | 400 | 必須 |
| 10 | GET | /departments | 部署一覧取得 | admin | なし | { departments }（ツリー構造） | 403 | 必須 |
| 11 | POST | /departments | 部署作成 | admin | name, parentId? | { department } | 400 | 必須 |
| 12 | PATCH | /departments/:id | 部署更新 | admin | name?, parentId?, sortOrder? | { department } | 404 | 必須 |
| 13 | DELETE | /departments/:id | 部署削除 | admin | なし | { success: true } | 409 所属ユーザーあり | 必須 |

---

## 3. ワークタイプ API ★差別化機能

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | /work-types | ワークタイプ一覧取得 | all | ?active=true | { workTypes } | 403 | 必須 |
| 2 | POST | /work-types | ワークタイプ作成 | admin | name, color, billingType, isBillable, sortOrder | { workType } | 400 | 必須 |
| 3 | PATCH | /work-types/:id | ワークタイプ更新 | admin | name?, color?, billingType?, isActive?, sortOrder? | { workType } | 400 / 404 | 必須 |
| 4 | DELETE | /work-types/:id | ワークタイプ無効化 | admin | なし | { success: true } | 409 打刻レコードが存在 | 必須 |
| 5 | PATCH | /work-types/reorder | ワークタイプ並び替え | admin | orders: [{ id, sortOrder }] | { success: true } | 400 | 必須 |

---

## 4. 打刻 API ★差別化機能の核心

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | /time-records/today | 本日の自分の打刻一覧 | all | なし | { records, summary: { totalMin, breakMin, workTypeBreakdown } } | 401 | 必須 |
| 2 | POST | /time-records/clock-in | 出勤打刻 | all | workTypeId, locationLat?, locationLng?, deviceType? | { record } | 400 既に出勤中 / 404 | 必須 |
| 3 | POST | /time-records/clock-out | 退勤打刻 | all | workTypeId, locationLat?, locationLng? | { record, dailySummary } | 400 出勤打刻なし | 必須 |
| 4 | POST | /time-records/break-start | 休憩開始打刻 | all | workTypeId | { record } | 400 | 必須 |
| 5 | POST | /time-records/break-end | 休憩終了打刻 | all | workTypeId | { record } | 400 | 必須 |
| 6 | POST | /time-records/switch-type | ワークタイプ切替打刻 | all | fromWorkTypeId, toWorkTypeId, locationLat?, locationLng? | { clockOutRecord, clockInRecord } | 400 / 404 | 必須 |
| 7 | GET | /time-records | 打刻履歴一覧（自分） | all | ?from&to&workTypeId&page&limit | { records, total } | 400 | 必須 |
| 8 | GET | /time-records/users/:userId | 指定ユーザーの打刻履歴 | manager | ?from&to&workTypeId&page&limit | { records, total } | 403 / 404 | 必須 |
| 9 | GET | /time-records/team | チームの本日打刻状況 | manager | ?date | { summary: { working, left, holiday, absent } } | 403 | 必須 |
| 10 | PATCH | /time-records/:id | 打刻修正（管理者） | manager | clockedAt, reason | { record } | 403 / 404 | 必須 |
| 11 | GET | /time-records/summary/monthly | 月次稼働サマリー（種別別集計） | all | ?userId&year&month | { totalHours, overtimeHours, workTypeBreakdown } | 403 | 必須 |

---

## 5. シフト API

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | /shift-patterns | シフトパターン一覧 | all | なし | { patterns } | 403 | 必須 |
| 2 | POST | /shift-patterns | シフトパターン作成 | admin | name, startTime, endTime, breakMinutes | { pattern } | 400 | 必須 |
| 3 | PATCH | /shift-patterns/:id | シフトパターン更新 | admin | name?, startTime?, endTime?, breakMinutes?, isActive? | { pattern } | 404 | 必須 |
| 4 | GET | /shifts | シフト一覧取得（自分） | all | ?from&to | { shifts } | 400 | 必須 |
| 5 | GET | /shifts/team | チームシフト一覧 | manager | ?from&to&userId | { shifts } | 403 | 必須 |
| 6 | POST | /shifts/bulk | シフト一括作成・更新 | manager | shifts: [{ userId, shiftDate, startTime, endTime, workTypeId?, shiftPatternId? }] | { created, updated, errors } | 400 | 必須 |
| 7 | DELETE | /shifts/:id | シフト削除 | manager | なし | { success: true } | 404 | 必須 |
| 8 | POST | /shifts/publish | シフト公開（通知送信） | manager | shiftIds: [uuid] | { published, notified } | 400 | 必須 |
| 9 | POST | /shifts/preference | シフト希望提出 | employee | preferences: [{ date, preferredStart, preferredEnd, note? }] | { submitted } | 400 | 必須 |

---

## 6. 申請・承認 API

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | /requests | 申請一覧（自分） | all | ?type&status&from&to&page&limit | { requests, total } | 401 | 必須 |
| 2 | POST | /requests | 申請提出 | all | requestType, startDate, endDate?, startTime?, endTime?, targetRecordId?, reason? | { request } | 400 / 409 | 必須 |
| 3 | GET | /requests/:id | 申請詳細取得 | all | なし | { request, approvals } | 403 / 404 | 必須 |
| 4 | DELETE | /requests/:id | 申請取り消し | all | なし | { success: true } | 400 承認済み取消不可 | 必須 |
| 5 | GET | /requests/pending | 未承認申請一覧（承認者用） | manager | ?type&from&to&page&limit | { requests, total } | 403 | 必須 |
| 6 | POST | /requests/:id/approve | 申請承認 | manager | comment? | { approval, nextStep? } | 400 / 403 | 必須 |
| 7 | POST | /requests/:id/reject | 申請却下 | manager | comment | { approval } | 400 / 403 | 必須 |
| 8 | GET | /requests/leave-balance/:userId | 有給残日数取得 | all | なし | { total, used, remaining, expires } | 403 | 必須 |

---

## 7. 精算・請求 API ★差別化機能

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | /billing/contracts | 精算契約一覧 | admin | ?active=true | { contracts } | 403 | 必須 |
| 2 | POST | /billing/contracts | 精算契約作成 | admin | workTypeId, clientName, billingType, minHours?, maxHours?, baseAmount?, overRate?, underRate?, contractStart, contractEnd? | { contract } | 400 | 必須 |
| 3 | GET | /billing/contracts/:id | 精算契約詳細 | admin | なし | { contract, members } | 404 | 必須 |
| 4 | PATCH | /billing/contracts/:id | 精算契約更新 | admin | clientName?, billingType?, minHours?, maxHours?, ... | { contract } | 400 | 必須 |
| 5 | POST | /billing/contracts/:id/members | メンバーアサイン | admin | userId, assignedFrom, assignedTo? | { member } | 409 重複アサイン | 必須 |
| 6 | DELETE | /billing/contracts/:id/members/:memberId | メンバー解除 | admin | なし | { success: true } | 404 | 必須 |
| 7 | GET | /billing/summaries | 月次精算サマリー一覧 | admin | ?year&month&contractId | { summaries } | 403 | 必須 |
| 8 | POST | /billing/summaries/calculate | 月次精算計算実行 | admin | contractId, year, month | { summary } | 400 計算済み | 必須 |
| 9 | POST | /billing/summaries/:id/confirm | 精算確定 | admin | なし | { summary } | 400 既確定 | 必須 |
| 10 | GET | /billing/summaries/:id/invoice | 請求書ドラフトPDF生成 | admin | なし | PDF（binary） | 400 未確定 | 必須 |
| 11 | GET | /billing/reports/work-type | 種別別稼働レポート | admin | ?year&month&userId&workTypeId | { breakdown, totalHours, totalAmount } | 403 | 必須 |

---

## 8. レポート・通知 API

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | /reports/attendance/monthly | 月次勤怠サマリー | admin | ?year&month&userId&deptId | { users: [{ name, totalHours, overtime, absent }] } | 403 | 必須 |
| 2 | GET | /reports/attendance/export | 月次勤怠CSVエクスポート | admin | ?year&month&deptId | CSV（text/csv） | 403 | 必須 |
| 3 | GET | /reports/overtime | 残業時間レポート（36協定） | admin | ?year&month&userId&threshold | { users: [{ name, hours, threshold, alert }] } | 403 | 必須 |
| 4 | GET | /reports/leave | 有給消化レポート | admin | ?year&deptId | { users: [{ name, total, used, remaining }] } | 403 | 必須 |
| 5 | GET | /notifications | 通知一覧取得 | all | ?unreadOnly=true&page&limit | { notifications, unreadCount } | 401 | 必須 |
| 6 | POST | /notifications/:id/read | 通知既読 | all | なし | { success: true } | 404 | 必須 |
| 7 | POST | /notifications/read-all | 全通知既読 | all | なし | { count } | 401 | 必須 |

---

## 9. サブスクリプション・課金 API（2026-09-22追加）

Stripe Checkout + Customer Portalによる自社SaaS課金。§7の「精算・請求 API」（客先への請求計算）とは別物なので注意。詳細: [TECH-STACK.md](../TECH-STACK.md)

| # | メソッド | エンドポイント | 概要 | ロール | リクエスト | レスポンス | エラー | 認証 |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | /subscription | 現在のプラン・契約状況取得 | admin, manager | なし | { subscription: { plan, status, currentPeriodEnd, billedSeats, hasStripeCustomer } } | 401/403 | 必須 |
| 2 | POST | /subscription/checkout | Stripe Checkoutセッション作成（プラン加入・変更） | admin | plan（standard\|pro）, seats | { url } | 400 / 500 PLAN_UNAVAILABLE | 必須 |
| 3 | POST | /subscription/portal | Stripe Customer Portalセッション作成 | admin | なし | { url } | 400 NO_SUBSCRIPTION | 必須 |
| 4 | PATCH | /subscription/seats | 契約人数の手動更新 | admin | seats | { success: true, billedSeats } | 400 NO_SUBSCRIPTION | 必須 |
| 5 | POST | /webhooks/stripe | Stripe Webhook受信（署名検証） | - | Stripe Event（生ボディ） | { received: true } | 400 signature invalid | Stripe署名のみ（セッション認証なし） |

Enterpriseプランは個別見積もりのためStripeを経由せず、スーパー管理者が `core.tenants.plan` を手動で `enterprise` に設定する運用（Checkout API・Webhookの対象外）。
