# db-design.md — DB設計書

> PostgreSQL 16+ / 2スキーマ構成（core / app）/ RLSによるマルチテナント分離

---

## 1. スキーマ構成

| スキーマ名 | 用途 | テーブル数 | 主なテーブル | 備考 |
|---|---|---|---|---|
| `core` | テナント・ユーザー・組織管理 | 3 | tenants, users, departments | 全テーブルの認証・RLS起点 |
| `app` | 勤怠管理サービスの全業務機能 | 11 | work_types, time_records, shift_patterns, shifts, requests, request_approvals, billing_contracts, billing_contract_members, billing_summaries, notifications, audit_logs | audit_logsはINSERT専用ロールで保護 |

---

## 2. テーブル一覧

| # | スキーマ | テーブル名 | カテゴリ | 概要 | 行数目安 |
|---|---|---|---|---|---|
| 1 | core | tenants | テナント管理 | SaaS契約企業のマスタ | 〜10,000 |
| 2 | core | users | ユーザー管理 | 従業員・管理者のアカウント | 〜1,000,000 |
| 3 | core | departments | 組織管理 | 部署・チームの階層構造（自己参照） | 〜100,000 |
| 4 | app | work_types | 種別管理 | 作業種別定義 ★差別化機能 | 〜500,000 |
| 5 | app | time_records | 勤怠 | 打刻記録（種別連動）★差別化機能 | 〜500,000,000 |
| 6 | app | shift_patterns | シフト | シフトパターン雛形 | 〜1,000,000 |
| 7 | app | shifts | シフト | 従業員別の日次シフト | 〜100,000,000 |
| 8 | app | requests | 申請 | 有給・残業・打刻修正等の申請を一元管理 | 〜50,000,000 |
| 9 | app | request_approvals | 申請 | 申請の承認フロー（最大3ステップ） | 〜150,000,000 |
| 10 | app | billing_contracts | 精算 | 客先との精算契約定義 ★差別化機能 | 〜100,000 |
| 11 | app | billing_contract_members | 精算 | 契約へのメンバーアサイン | 〜1,000,000 |
| 12 | app | billing_summaries | 精算 | 月次精算集計 ★差別化機能 | 〜10,000,000 |
| 13 | app | notifications | 共通 | 打刻漏れ・申請・アラート等の通知管理 | 〜1,000,000,000 |
| 14 | app | audit_logs | 共通 | 操作ログ（5年保管・追記型・UPDATE禁止） | 〜無制限 |

---

## 3. テーブル定義

### core.tenants

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | テナントID |
| name | VARCHAR(255) | | NOT NULL | 企業名 |
| plan | VARCHAR(50) | | NOT NULL | 契約プラン（free / standard / pro / enterprise） |
| status | VARCHAR(50) | | NOT NULL | ステータス（active / suspended / cancelled） |
| max_users | INTEGER | | NULL | プランの最大ユーザー数 |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | | NOT NULL | 更新日時 |

インデックス: `idx_tenants_status`(status), `idx_tenants_plan`(plan)

---

### core.users

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | ユーザーID |
| tenant_id | UUID | FK → core.tenants | NOT NULL | 所属テナントID |
| department_id | UUID | FK → core.departments | NULL | 所属部署ID |
| name | VARCHAR(100) | | NOT NULL | 氏名 |
| email | VARCHAR(255) | UNIQUE | NOT NULL | メールアドレス（ログインID） |
| role | VARCHAR(50) | | NOT NULL | ロール（admin / manager / employee） |
| employment_type | VARCHAR(50) | | NOT NULL | 雇用形態（full_time / part_time / contractor） |
| hourly_rate | DECIMAL(10,2) | | NULL | 時給 |
| monthly_salary | DECIMAL(12,2) | | NULL | 月給 |
| is_active | BOOLEAN | | NOT NULL | 有効フラグ（退職時はfalse） |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | | NOT NULL | 更新日時 |

インデックス: `idx_users_tenant_id`(tenant_id), `idx_users_email`(email), `idx_users_tenant_role`(tenant_id, role)

---

### core.departments

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | 部署ID |
| tenant_id | UUID | FK → core.tenants | NOT NULL | 所属テナントID |
| parent_id | UUID | FK → core.departments | NULL | 親部署ID（NULL = 最上位） |
| name | VARCHAR(100) | | NOT NULL | 部署名 |
| sort_order | INTEGER | | NOT NULL | 表示順 |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |

インデックス: `idx_departments_tenant_id`(tenant_id), `idx_departments_parent_id`(parent_id)

---

### app.work_types ★差別化機能

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | ワークタイプID |
| tenant_id | UUID | FK → core.tenants | NOT NULL | 所属テナントID |
| name | VARCHAR(100) | | NOT NULL | 種別名（例：原籍業務、客先A現場） |
| color | VARCHAR(7) | | NOT NULL | 表示カラーコード（#RRGGBB） |
| billing_type | VARCHAR(50) | | NOT NULL | 精算方式（fixed / hourly / range / project） |
| is_billable | BOOLEAN | | NOT NULL | 請求対象かどうか |
| is_active | BOOLEAN | | NOT NULL | 有効フラグ |
| sort_order | INTEGER | | NOT NULL | 打刻画面での表示順 |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |

インデックス: `idx_work_types_tenant_id`(tenant_id), `idx_work_types_active`(tenant_id, is_active)

---

### app.time_records ★差別化機能

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | 打刻レコードID |
| user_id | UUID | FK → core.users | NOT NULL | 打刻したユーザーID |
| work_type_id | UUID | FK → app.work_types | NOT NULL | 打刻時の作業種別ID |
| record_type | VARCHAR(50) | | NOT NULL | 打刻種別（clock_in / clock_out / break_start / break_end） |
| clocked_at | TIMESTAMPTZ | | NOT NULL | 打刻日時 |
| location_lat | DECIMAL(9,6) | | NULL | 打刻時の緯度（GPS打刻時） |
| location_lng | DECIMAL(9,6) | | NULL | 打刻時の経度（GPS打刻時） |
| device_type | VARCHAR(50) | | NULL | 打刻デバイス種別（web / qr / ic_card） |
| is_modified | BOOLEAN | | NOT NULL | 管理者修正フラグ |
| modified_by | UUID | FK → core.users | NULL | 修正したユーザーID |
| modified_at | TIMESTAMPTZ | | NULL | 修正日時 |
| original_clocked_at | TIMESTAMPTZ | | NULL | 修正前の元打刻日時 |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |

インデックス: `idx_tr_user_clocked`(user_id, clocked_at), `idx_tr_worktype_clocked`(work_type_id, clocked_at), `idx_tr_modified`(user_id, clocked_at) WHERE is_modified=true

---

### app.shift_patterns

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | シフトパターンID |
| tenant_id | UUID | FK → core.tenants | NOT NULL | 所属テナントID |
| name | VARCHAR(100) | | NOT NULL | パターン名 |
| start_time | TIME | | NOT NULL | 開始時刻 |
| end_time | TIME | | NOT NULL | 終了時刻 |
| break_minutes | INTEGER | | NOT NULL | 休憩時間（分） |
| is_active | BOOLEAN | | NOT NULL | 有効フラグ |

---

### app.shifts

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | シフトID |
| user_id | UUID | FK → core.users | NOT NULL | 対象ユーザーID |
| work_type_id | UUID | FK → app.work_types | NULL | 予定作業種別ID |
| shift_pattern_id | UUID | FK → app.shift_patterns | NULL | 適用したシフトパターンID |
| shift_date | DATE | | NOT NULL | シフト日付 |
| start_time | TIME | | NOT NULL | 開始時刻 |
| end_time | TIME | | NOT NULL | 終了時刻 |
| status | VARCHAR(50) | | NOT NULL | ステータス（draft / published / cancelled） |
| created_by | UUID | FK → core.users | NOT NULL | 作成者 |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |

インデックス: `idx_shifts_user_date`(user_id, shift_date), `idx_shifts_tenant_date`(shift_date, tenant_id)

---

### app.requests

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | 申請ID |
| user_id | UUID | FK → core.users | NOT NULL | 申請者ユーザーID |
| tenant_id | UUID | FK → core.tenants | NOT NULL | 所属テナントID |
| request_type | VARCHAR(50) | | NOT NULL | 種別（paid_leave / overtime / clock_fix / remote / substitute / special_leave） |
| start_date | DATE | | NULL | 申請開始日 |
| end_date | DATE | | NULL | 申請終了日 |
| start_time | TIME | | NULL | 開始時刻 |
| end_time | TIME | | NULL | 終了時刻 |
| target_record_id | UUID | FK → app.time_records | NULL | 打刻修正申請の対象打刻ID |
| reason | TEXT | | NULL | 申請理由 |
| status | VARCHAR(50) | | NOT NULL | ステータス（pending / approved / rejected / cancelled） |
| created_at | TIMESTAMPTZ | | NOT NULL | 申請日時 |
| updated_at | TIMESTAMPTZ | | NOT NULL | 更新日時 |

インデックス: `idx_req_user_status`(user_id, status), `idx_req_tenant_status`(tenant_id, status, created_at)

---

### app.request_approvals

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | 承認レコードID |
| request_id | UUID | FK → app.requests | NOT NULL | 対象申請ID |
| approver_id | UUID | FK → core.users | NOT NULL | 承認者ユーザーID |
| step | INTEGER | | NOT NULL | 承認ステップ番号（1〜3） |
| status | VARCHAR(50) | | NOT NULL | 承認ステータス（pending / approved / rejected） |
| comment | TEXT | | NULL | 承認・却下コメント |
| approved_at | TIMESTAMPTZ | | NULL | 承認・却下日時 |

---

### app.billing_contracts ★差別化機能

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | 契約ID |
| tenant_id | UUID | FK → core.tenants | NOT NULL | 所属テナントID |
| work_type_id | UUID | FK → app.work_types | NOT NULL | 対象ワークタイプID |
| client_name | VARCHAR(255) | | NOT NULL | 客先名 |
| billing_type | VARCHAR(50) | | NOT NULL | 精算方式（fixed / hourly / range / project） |
| min_hours | DECIMAL(6,2) | | NULL | 精算下限時間（range方式） |
| max_hours | DECIMAL(6,2) | | NULL | 精算上限時間（range方式） |
| base_amount | DECIMAL(12,2) | | NULL | 基本精算金額（fixed方式） |
| over_rate | DECIMAL(10,2) | | NULL | 超過単価（円/時） |
| under_rate | DECIMAL(10,2) | | NULL | 不足控除単価（円/時） |
| contract_start | DATE | | NOT NULL | 契約開始日 |
| contract_end | DATE | | NULL | 契約終了日（NULL = 継続中） |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |

---

### app.billing_contract_members

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | レコードID |
| contract_id | UUID | FK → app.billing_contracts | NOT NULL | 精算契約ID |
| user_id | UUID | FK → core.users | NOT NULL | アサインされたユーザーID |
| assigned_from | DATE | | NOT NULL | アサイン開始日 |
| assigned_to | DATE | | NULL | アサイン終了日（NULL = 継続中） |

---

### app.billing_summaries ★差別化機能

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | 集計ID |
| contract_id | UUID | FK → app.billing_contracts | NOT NULL | 精算契約ID |
| year | INTEGER | | NOT NULL | 集計年 |
| month | INTEGER | | NOT NULL | 集計月 |
| actual_hours | DECIMAL(8,2) | | NOT NULL | 実稼働時間 |
| billing_hours | DECIMAL(8,2) | | NOT NULL | 請求対象時間 |
| over_hours | DECIMAL(8,2) | | NULL | 超過時間 |
| under_hours | DECIMAL(8,2) | | NULL | 不足時間 |
| billing_amount | DECIMAL(12,2) | | NOT NULL | 請求金額 |
| status | VARCHAR(50) | | NOT NULL | ステータス（calculating / confirmed / invoiced） |
| confirmed_at | TIMESTAMPTZ | | NULL | 確定日時 |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |

インデックス: `idx_bs_contract_ym`(contract_id, year, month)

---

### app.notifications

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | 通知ID |
| tenant_id | UUID | FK → core.tenants | NOT NULL | 所属テナントID |
| user_id | UUID | FK → core.users | NOT NULL | 通知対象ユーザーID |
| type | VARCHAR(100) | | NOT NULL | 通知種別（clock_missing / request_submitted / billing_alert 等） |
| title | VARCHAR(255) | | NOT NULL | 通知タイトル |
| body | TEXT | | NULL | 通知本文 |
| link_url | VARCHAR(500) | | NULL | リンク先URL |
| is_read | BOOLEAN | | NOT NULL | 既読フラグ |
| created_at | TIMESTAMPTZ | | NOT NULL | 作成日時 |

インデックス: `idx_notif_user_read`(user_id, is_read)

---

### app.audit_logs

> ⚠️ INSERT のみ。UPDATE / DELETE は禁止（5年保管・法令対応）。

| カラム名 | 型 | 制約 | NULL | 説明 |
|---|---|---|---|---|
| id | UUID | PK | NOT NULL | ログID |
| tenant_id | UUID | FK → core.tenants | NOT NULL | 所属テナントID |
| user_id | UUID | FK → core.users | NULL | 操作ユーザーID |
| action | VARCHAR(100) | | NOT NULL | 操作種別（create / update / delete / login / logout 等） |
| resource_type | VARCHAR(100) | | NOT NULL | 操作対象リソース種別 |
| resource_id | UUID | | NULL | 操作対象リソースID |
| before_value | JSONB | | NULL | 変更前の値（JSON） |
| after_value | JSONB | | NULL | 変更後の値（JSON） |
| ip_address | INET | | NULL | 操作元IPアドレス |
| user_agent | TEXT | | NULL | 操作元UserAgent |
| created_at | TIMESTAMPTZ | | NOT NULL | 操作日時 |

インデックス: `idx_al_tenant_created`(tenant_id, created_at), `idx_al_resource`(resource_type, resource_id)
