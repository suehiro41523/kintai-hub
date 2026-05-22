# DOMAIN-RULES.md — ビジネスロジック・ドメインルール

## ワークタイプ（最重要）

従業員が打刻する際に選択する「作業種別」です。
テナントごとに自由に定義できます。

**SES企業の設定例：**
- `原籍業務`（is_billable: false）
- `客先A（○○社）`（is_billable: true）
- `客先B（△△社）`（is_billable: true）
- `研修・教育`（is_billable: false）

## 打刻ルール

### 出勤打刻（clock-in）の必須チェック
1. `workTypeId` が自テナント内に存在し `is_active = true` であること
2. 未退勤の `time_record` が存在しないこと（既に出勤中でないこと）
3. IPアドレス制限が設定されている場合は送信元IPを確認

### 退勤打刻（clock-out）の必須チェック
1. 未退勤の `time_record` が存在すること

### ワークタイプ切替（switch-type）の処理
内部的に **clock-out → clock-in をトランザクションで実行** します。
1. `fromWorkTypeId` で clock-out
2. `toWorkTypeId` で clock-in
3. 両方の `time_record` を同一トランザクションで作成

### 打刻種別（record_type）の値
| 値 | 意味 |
|---|---|
| `clock_in` | 出勤 |
| `clock_out` | 退勤 |
| `break_start` | 休憩開始 |
| `break_end` | 休憩終了 |

## 精算ロジック

`billing_contracts.billing_type` の値で計算方法が変わります。

| billing_type | 計算方法 |
|---|---|
| `fixed` | 稼働時間に関わらず `base_amount` を請求 |
| `hourly` | `actual_hours × over_rate`（時間単価） |
| `range` | `min_hours〜max_hours` 内は固定金額。超過分は `over_rate × 超過時間` を加算、不足分は `under_rate × 不足時間` を減算 |
| `project` | 工数は記録するが請求額は手動設定（`billing_amount` を直接入力） |

### `range` 方式の計算例
```
契約: min=140h, max=180h, base=500,000円, over_rate=3,500円/h, under_rate=3,000円/h

実績172h（上限内）: → 500,000円（範囲内のため固定）
実績190h（上限超過）: → 500,000 + (190 - 180) × 3,500 = 535,000円
実績120h（下限不足）: → 500,000 - (140 - 120) × 3,000 = 440,000円
```

## 申請ステータスの遷移

```
pending → approved（全ステップ承認）
pending → rejected（いずれかのステップで却下）
pending → cancelled（申請者が取り消し）
```

承認済み・却下済みの申請は取り消し不可です。

## 有給管理ルール

- 付与日数は労働基準法に基づき自動計算（勤続年数・所定労働日数）
- 年間5日取得義務を管理者ダッシュボードで可視化
- 有給残数は `requests` テーブルの承認済みレコードを集計して算出

## 36協定アラート

`reports/overtime` APIは月の残業時間が以下の閾値を超えた場合にアラートフラグを返します：
- 警告: 40時間以上
- 危険: 45時間以上
- 超過: 80時間以上（特別条項の上限）
