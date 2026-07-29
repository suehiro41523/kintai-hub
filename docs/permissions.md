# 権限設計書

## ロール定義

| ロール | 説明 |
|---|---|
| `admin` | テナント管理者。全操作が可能 |
| `manager` | マネージャー。チームレベルの操作が可能 |
| `employee` | 一般従業員。自分自身に関する操作のみ可能 |

## 凡例

| 記号 | 意味 |
|---|---|
| ○ | 操作可能 |
| 自 | 自分のデータのみ操作可能 |
| 閲 | 閲覧のみ可能（一覧・詳細取得） |
| - | 操作不可 |

---

## 権限マトリクス

### 認証（/auth）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| ログイン | POST /auth/sign-in | ○ | ○ | ○ |
| ログアウト | POST /auth/sign-out | ○ | ○ | ○ |
| 自分の情報取得 | GET /auth/me | ○ | ○ | ○ |

---

### 従業員管理（/users）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| 従業員一覧取得 | GET /users | - | - | ○ |
| 従業員作成 | POST /users | - | - | ○ |
| 従業員情報更新 | PATCH /users/:id | - | - | ○ |
| 従業員無効化 | DELETE /users/:id | - | - | ○ |

---

### ワークタイプ（/work-types）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| 一覧取得 | GET /work-types | ○ | ○ | ○ |
| 作成 | POST /work-types | - | - | ○ |
| 更新 | PATCH /work-types/:id | - | - | ○ |
| 並び替え | PATCH /work-types/reorder | - | - | ○ |
| 削除（無効化） | DELETE /work-types/:id | - | - | ○ |

---

### 打刻・勤怠記録（/time-records）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| 今日の打刻情報取得 | GET /time-records/today | 自 | 自 | 自 |
| 出勤打刻 | POST /time-records/clock-in | 自 | 自 | 自 |
| 退勤打刻 | POST /time-records/clock-out | 自 | 自 | 自 |
| 休憩開始 | POST /time-records/break-start | 自 | 自 | 自 |
| 休憩終了 | POST /time-records/break-end | 自 | 自 | 自 |
| ワークタイプ切替 | POST /time-records/switch-type | 自 | 自 | 自 |
| 自分の打刻履歴取得 | GET /time-records | 自 | 自 | 自 |
| チームの打刻履歴取得 | GET /time-records/team | - | ○ | ○ |
| 打刻修正 | PATCH /time-records/:id | - | ○ | ○ |

---

### シフト（/shifts）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| 自分のシフト取得 | GET /shifts | 自 | 自 | 自 |
| チームシフト取得 | GET /shifts/team | - | ○ | ○ |
| シフト一括作成・更新 | POST /shifts/bulk | - | ○ | ○ |
| シフト削除 | DELETE /shifts/:id | - | ○ | ○ |

---

### シフトパターン（/shift-patterns）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| 一覧取得 | GET /shift-patterns | ○ | ○ | ○ |
| 作成 | POST /shift-patterns | - | - | ○ |
| 更新 | PATCH /shift-patterns/:id | - | - | ○ |

---

### 申請（/requests）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| 自分の申請一覧 | GET /requests/my | 自 | 自 | 自 |
| 申請作成 | POST /requests | 自 | 自 | 自 |
| 申請取消 | DELETE /requests/:id | 自 | 自 | 自 |
| 承認待ち一覧取得 | GET /requests/pending | - | ○ | ○ |
| 申請承認 | POST /requests/:id/approve | - | ○ | ○ |
| 申請却下 | POST /requests/:id/reject | - | ○ | ○ |

---

### 請求管理（/billing）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| 契約一覧取得 | GET /billing/contracts | - | 閲 | ○ |
| 契約詳細取得 | GET /billing/contracts/:id | - | 閲 | ○ |
| 契約作成 | POST /billing/contracts | - | - | ○ |
| 契約更新 | PATCH /billing/contracts/:id | - | - | ○ |
| 契約削除 | DELETE /billing/contracts/:id | - | - | ○ |
| 精算一覧取得 | GET /billing/summaries | - | 閲 | ○ |
| 精算計算実行 | POST /billing/summaries/calculate | - | - | ○ |
| 精算確定 | POST /billing/summaries/:id/confirm | - | - | ○ |

---

### レポート（/reports）

| 操作 | endpoint | employee | manager | admin |
|---|---|:---:|:---:|:---:|
| 月次レポート取得 | GET /reports/monthly | 自 | ○ | ○ |
