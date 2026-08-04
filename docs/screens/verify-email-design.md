# verify-email-design.md — メール認証画面設計書

> バージョン: 1.0 / 作成日: 2026-08-03 / ステータス: ドラフト
> 対象パス: `/verify-email`（新規） / 関連: [signup-page-design.md](./signup-page-design.md), [AUTH-DESIGN.md](../../AUTH-DESIGN.md)

---

## 0. 前提・スコープ

- [signup-page-design.md 8章](./signup-page-design.md#8-関連画面メール認証待ちverify-email)で「詳細設計は別途」としていた画面の本設計。
- 本画面は **2つの異なる文脈** で同一パスに表示される、1つのReactページ（`apps/web/src/app/verify-email/page.tsx`）とする。
  - **パターンA（待機）**：`/signup` 完了直後の遷移先。URLクエリ無し。「メールを送ったので確認してください」の待機画面。
  - **パターンB（結果表示）**：メール本文中のリンク（Better Authがサーバー側で検証した後にリダイレクトしてくる先）としての着地。フロントはtokenを受け取らず、`error`クエリの有無・値と `GET /auth/session` の結果から成功／失敗を表示する。
- 認証方式は [AUTH-DESIGN.md](../../AUTH-DESIGN.md) の通り Better Auth（セルフホスト）+ Cookieセッション。サインアップ完了時点（`POST /auth/sign-up`）で既に `session_token` が発行されCookieがセットされている＝**ユーザーは未認証ではなく「メール未確認のログイン中ユーザー」**という状態になる点が設計上の前提。
- **メール確認方式は Better Auth 標準機能に委譲する（確定）。** カスタムの検証APIはアプリ側（`/api/v1/...`）に実装しない。トークンはBetter Auth標準ルート（`GET /auth/verify-email`）がAPIサーバー側で直接検証し、結果に応じて `callbackURL` へリダイレクトする。**フロントの `/verify-email` ページは token を一度も受け取らない**（メール本文中のリンクはNext.jsではなくAPIサーバーを直接指す）。詳細は5章。

---

## 1. 目的・ゴール

| 項目 | 内容 |
|---|---|
| 画面の役割 | メールアドレスの実在確認を行い、未確認ユーザーをダッシュボード利用可能な状態にする |
| 完了条件 | メール確認が完了し、`core.users` 側の確認フラグが立った状態で `/clock` へ到達する |
| 離脱防止方針 | 「何をすればいいか」「メールが来ない時どうするか」を常に画面上に明示する |

---

## 2. 画面パターンと遷移

```
[/signup] 送信成功
   ↓ router.replace('/verify-email')
[/verify-email]（パターンA：待機。errorクエリ無し・emailVerified=false）
   - GET /auth/session から email・emailVerified を取得
   - 「確認メールを送信しました」
   - [確認メールを再送信] ボタン → POST /auth/send-verification-email
   ↓（別タブ／別デバイスでメールを開きリンクをクリック）
メール内リンクはNext.jsの/verify-emailではなく、APIサーバーのBetter Auth標準ルートを直接指す
   例: {API_URL}/api/v1/auth/verify-email?token=...&callbackURL={WEB_URL}/verify-email
   ↓
Better Authがサーバー側でトークンを検証（フロントはこの時点では何も呼ばれていない）
   - 成功 or 既に確認済み → callbackURLへリダイレクト（クエリ付与なし）
   - 失敗 → callbackURL?error=TOKEN_EXPIRED / INVALID_TOKEN / USER_NOT_FOUND へリダイレクト
   ↓
[/verify-email]（パターンB：結果表示。ブラウザがリダイレクトで着地した状態）
   - errorクエリあり → 対応するエラー状態を表示
   - errorクエリなし → GET /auth/session で emailVerified を確認 → true なら成功表示 → [ダッシュボードへ進む] → /clock
```

**パターンAの画面を開いたままリンクをクリックした場合**（同一タブ運用）：リンク自体がAPIサーバーを指しているため、クリックした瞬間にNext.jsのページからは離脱し、Better Authの検証・リダイレクトを経て再び `/verify-email` に戻ってくる（＝パターンAとパターンBは同一URLへの「行って戻ってくる」遷移であり、フロント側でtokenを見て表示を切り替えるという分岐は不要）。

**別タブでリンクを開いた場合**（一般的な運用、確定仕様）：パターンAのタブは `visibilitychange`/`focus` イベントを監視し、タブがフォアグラウンドに復帰した瞬間に `GET /auth/session` を再取得する。`emailVerified: true` になっていれば自動的に `/clock` へリダイレクトする。メール内リンクをクリックした後に元のタブへ戻る操作を必ず伴うため、ポーリングは実装しない（API呼び出しを最小限に保つため）。

---

## 3. レイアウト構成

`/login` `/signup` と同一の中央寄せ単一カード構成を踏襲する。

### 3.1 パターンA（待機）

```
┌─────────────────────────────────────┐
│  [Clockアイコン] KintaiHub            │
│                                       │
│  ┌─────────────────────────────┐    │
│  │        ✉（封筒アイコン）      │    │
│  │                               │    │
│  │  確認メールを送信しました       │    │ ← 見出し
│  │                               │    │
│  │  admin@example.com 宛に        │    │ ← セッションから取得したemail
│  │  確認リンクを送信しました。     │    │
│  │  メール内のリンクをクリックして  │    │
│  │  登録を完了してください。       │    │
│  │                               │    │
│  │  [   確認メールを再送信   ]    │    │ ← secondaryボタン
│  │                               │    │
│  │  メールが届かない場合は        │    │
│  │  迷惑メールフォルダをご確認     │    │
│  │  いただくか、再送信をお試し     │    │
│  │  ください。                   │    │
│  └─────────────────────────────┘    │
│                                       │
│  メールアドレスを間違えましたか？      │
│  登録をやり直す →（/signup）         │
└─────────────────────────────────────┘
```

### 3.2 パターンB（結果表示）

トークン検証自体はBetter Authが着地前に完了させているため、フロントの「検証中」はページマウント直後の `GET /auth/session` 確認（一瞬）のみ。状態に応じて中央のアイコン／見出し／本文／ボタンを差し替える（カード枠は共通）。

```
┌─────────────────────────────┐
│      ⏳ / ✅ / ⚠️              │ ← 状態に応じたアイコン
│                               │
│  確認しています…              │ ← セッション確認中（一瞬）
│  （or メール認証が完了しました） │ ← 成功
│  （or リンクの有効期限が切れて   │ ← 失敗
│   います）                    │
│                               │
│  [ ダッシュボードへ進む ]      │ ← 成功時のみ
│  [ 確認メールを再送信 ]        │ ← 失敗時のみ
└─────────────────────────────┘
```

---

## 4. 状態定義とUI

| 状態 | 発生条件 | 表示 | ボタン |
|---|---|---|---|
| `checking`（確認中） | マウント直後、`GET /auth/session` 応答待ちの一瞬 | スピナー＋「確認しています…」 | なし |
| `waiting`（待機） | `error`クエリ無し ＋ `session.user.emailVerified === false` | 3.1のレイアウト | 「確認メールを再送信」 |
| `resending` | 再送信ボタン押下中 | ボタンを「送信中...」+ disabled | — |
| `resent` | 再送信成功 | ボタン下に「再送信しました」（`text-green-600`、数秒でフェードアウト or 常時表示） | 「確認メールを再送信」（再度押下可、7章のレート制限に従う） |
| `verified`（成功） | `error`クエリ無し ＋ `session.user.emailVerified === true`（Better Auth側で「新規に確認」「既に確認済み」のどちらだったかは判別しない。同じ表示に統合） | ✅＋「メール認証が完了しました」 | 「ダッシュボードへ進む」（`/clock`） |
| `expired`（期限切れ） | `?error=TOKEN_EXPIRED` | ⚠️＋「リンクの有効期限が切れています」 | 「確認メールを再送信」 |
| `invalid`（不正トークン） | `?error=INVALID_TOKEN` または `?error=USER_NOT_FOUND` | ⚠️＋「無効なリンクです」 | 「ログイン画面へ」（`/login`） |

`already_verified` は独立した状態にしない：Better Auth標準ルートは「新規に確認できた場合」と「既に確認済みだった場合」のどちらも `callbackURL` へエラー無しでリダイレクトするため、フロント側では区別できず・区別する必要もない（`verified`状態に統合）。

---

## 5. API連携

メール確認はBetter Auth標準機能に委譲する（確定）。カスタムAPIは実装せず、Better Authが標準で提供する以下2エンドポイントをそのまま使う（`api-spec.md` 1章に追記済み）。

| メソッド | エンドポイント | 概要 | フロントの呼び方 |
|---|---|---|---|
| GET | `/auth/verify-email` | トークン検証。成功/既確認は `callbackURL` へ無印リダイレクト、失敗は `callbackURL?error=CODE` へリダイレクト | フロントからは呼ばない。メール本文のリンク先として使うのみ |
| POST | `/auth/send-verification-email` | 確認メール送信・再送信。body: `email`, `callbackURL?` | 再送信ボタンから呼ぶ |

パターンAでの表示メールアドレス・確認状態の取得は新規APIを使わず、既存の `GET /auth/session`（`api-spec.md` 認証API #4）のレスポンス（`user.email`, `user.emailVerified`）を利用する。

**実装上の前提設定（Better Auth側）**

- `emailVerification.sendVerificationEmail` に Resend連携の送信処理を実装しないと `send-verification-email` は `400 VERIFICATION_EMAIL_NOT_ENABLED` を返す（必須設定）。
- トークン有効期限のデフォルトは1時間（3600秒）。4章決定の「24時間」を満たすには `emailVerification.expiresIn: 86400` の明示設定が必要（デフォルトのままでは要件を満たさない点に注意）。
- `POST /auth/send-verification-email` は既にログイン中（Cookieセッションあり）かつ `session.user.emailVerified === true` の場合 `400 EMAIL_ALREADY_VERIFIED` を返す。再送信ボタン押下時にこのエラーを受けたら「既に認証済みです」表示へ切り替え、`/clock` への導線を出す。

---

## 6. 送信・検証フロー

### パターンA：初期表示・再送信

```
ページマウント（URLにerrorクエリ無し）
   ↓
状態を checking に設定
   ↓
GET /auth/session
   ↓（emailVerified: true）verified に遷移 → 2〜3秒後 /clock へ自動リダイレクト（+ 手動ボタンも表示）
   ↓（emailVerified: false）waiting に遷移、email をセッションから表示

「確認メールを再送信」クリック
   ↓
ボタンを「送信中...」+ disabled
   ↓
POST /auth/send-verification-email { email, callbackURL: `${WEB_URL}/verify-email` }
   ↓（成功）「再送信しました」表示、7章のクールダウン開始
   ↓（400 EMAIL_ALREADY_VERIFIED）verified に遷移（他タブ等で確認済みになっていた場合）
   ↓（429）「しばらくしてから再度お試しください」+ 次回送信可能までの残り時間表示
```

### パターンB：メールリンク経由での着地

```
メール内リンククリック（ブラウザはAPIサーバーのBetter Authルートへ遷移。Next.jsページはまだ開始していない）
   ↓
Better Authがサーバー側でトークン検証
   ↓（成功 or 既に確認済み）/verify-email へリダイレクト（クエリ無し）
   ↓（失敗）/verify-email?error=TOKEN_EXPIRED|INVALID_TOKEN|USER_NOT_FOUND へリダイレクト
   ↓
Next.jsの/verify-emailページがマウント
   ↓（errorクエリあり）
      TOKEN_EXPIRED → expired に遷移
      INVALID_TOKEN / USER_NOT_FOUND → invalid に遷移
   ↓（errorクエリなし）
      上記「パターンA：初期表示」と同じ checking → GET /auth/session の分岐に合流
```

---

## 7. 再送信のレート制限

`api-spec.md` 共通仕様（認証エンドポイント: 10req/min）に準拠しつつ、UX上はより厳しいクールダウンをフロント側でも設ける。

- 再送信ボタンは1回押下後 **60秒間disabled**（連打防止、サーバー側レート制限に頼りきらない）
- disabled中はボタンラベルに残り秒数を表示：「再送信（あと45秒）」

---

## 8. デザイントーン

`/login` `/signup` と統一（[top-page-design.md 7章](./top-page-design.md#7-デザイントーンuiガイドライン)と同一基準）。

| 項目 | 値 |
|---|---|
| primaryボタン（ダッシュボードへ進む等） | `bg-blue-600 hover:bg-blue-700` |
| secondaryボタン（再送信） | `border border-slate-300 text-slate-700 hover:bg-slate-50` |
| 成功系アイコン・テキスト | `text-green-600` |
| 警告・エラー系アイコン・テキスト | `text-amber-600`（致命的エラーではないため`red`ではなく`amber`を採用） |
| カード | `bg-white rounded-xl shadow-sm border border-slate-200 p-6` |

---

## 9. アクセシビリティ・その他

- 確認中（`checking`）のスピナーには `aria-live="polite"` を付与し、状態変化がスクリーンリーダーに伝わるようにする
- 再送信のクールダウン残り秒数はボタンの `aria-label` にも反映（視覚的な秒数表示だけに依存しない）
- メールアドレスの表示は正しく取得できなかった場合（セッション取得失敗等）に空表示にならないよう、フォールバック文言「ご登録のメールアドレス宛に」を用意する

---

## 10. 今後の検討事項（未確定）

- 確認メール自体の文面・送信元設定（Resend連携）：11章に草案を作成済みだが、送信元ドメイン・法務文言・最終コピーは未承認

**決定済み（このドキュメント外にも反映）**

- メール確認方式：Better Auth標準機能に委譲（0章・5章に反映）
- トークン有効期限：24時間（`emailVerification.expiresIn: 86400` の明示設定が必要。5章に反映）
- メール確認未完了ユーザーが `/clock` 等へアクセスした場合のガード方針：「メールが未確認です」というブロッキングメッセージを表示する。詳細は [ui-permissions.md](../ui-permissions.md) の「未確認（メール未認証）ユーザーの挙動」を参照
- 別タブでリンクを開いた場合の待機タブ（パターンA）の自動更新方式：フォーカス時再取得のみ（`visibilitychange`/`focus`イベント）。ポーリングは実装しない（2章に反映）

---

## 11. 確認メール文面（草案・未承認）

送信元ドメイン・法務文言・最終コピーは未確定のため、実装着手前に要承認。`emailVerification.sendVerificationEmail`（Resend連携）に渡す内容の草案として以下を提案する。

| 項目 | 値（草案） |
|---|---|
| 送信元表示名 | KintaiHub |
| 送信元アドレス | `no-reply@（送信ドメイン未確定）` |
| 件名 | 【KintaiHub】メールアドレスの確認をお願いします |

**本文（草案）**

```
{{name}} 様

KintaiHubにご登録いただきありがとうございます。
以下のリンクをクリックして、メールアドレスの確認を完了してください。

{{verificationUrl}}

※このリンクの有効期限は24時間です。期限が切れた場合は、
　サインアップ画面またはログイン後の画面から再送信してください。

※このメールにお心当たりがない場合は、破棄していただいて構いません。
　お客様のメールアドレスが誤って入力された可能性があります。

--
KintaiHub
（フッター：会社情報・配信停止に関する記載は要法務確認。9〜10章の法務コンテンツ整備待ち）
```

- `{{verificationUrl}}` は Better Auth が生成する `GET /auth/verify-email?token=...&callbackURL=...` のフルURL
- HTML版のデザイン（ロゴ・ボタン化されたリンク等）は本草案では未定義。まずプレーンテキスト相当の内容で実装し、デザイン適用は別途
- 送信元ドメインはResendでのドメイン認証（SPF/DKIM）が必要。ドメイン未確定のため実装時はResendのテストドメインで仮運用し、確定後に切り替える
