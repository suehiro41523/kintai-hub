# verify-email-design.md — メール認証画面設計書

> バージョン: 2.0 / 作成日: 2026-08-03 / 更新日: 2026-09-28 / ステータス: ドラフト
> 対象パス: `/verify-email`（新規） / 関連: [signup-page-design.md](./signup-page-design.md), [AUTH-DESIGN.md](../../AUTH-DESIGN.md)

> 2026-09-28更新: 認証ライブラリをBetter AuthからSupabase Authに変更したことに伴い全面改訂（v1.0からの変更点は0章参照）。verifyOtpのエラーコード等、実装時にSupabase側の挙動を最終確認すべき箇所は「要確認」と明記した。

---

## 0. 前提・スコープ

- [signup-page-design.md 8章](./signup-page-design.md#8-関連画面メール認証待ちverify-email)で「詳細設計は別途」としていた画面の本設計。
- 本画面は **2つの異なる文脈** で同一パスに表示される、1つのReactページ（`apps/web/src/app/verify-email/page.tsx`）とする点はv1.0から変更なし。
  - **パターンA（待機）**：`/signup` 完了直後の遷移先。URLクエリ無し。「メールを送ったので確認してください」の待機画面。
  - **パターンB（結果表示）**：メール本文中のリンクとしての着地。ただしv1.0とは着地の仕組みが異なる（後述）。
- 認証方式は [AUTH-DESIGN.md](../../AUTH-DESIGN.md) の通り Supabase Auth（マネージド）+ JWT（Bearerトークン）。**Cookieは使わない。**

### v1.0（Better Auth）からの主な変更点

| 項目 | v1.0（Better Auth） | v2.0（Supabase Auth） |
|---|---|---|
| メール内リンクの飛び先 | APIサーバー（`{API_URL}/api/v1/auth/verify-email?token=...`）を直接指す | **フロントエンド自身**（`{WEB_URL}/verify-email?token_hash=...&type=email`）を指す |
| 検証の実行主体 | APIサーバー（Better Auth）がリンククリック時にサーバー側で検証済みの状態でフロントに着地する | **フロントエンドが**`/verify-email`ページのマウント時に`supabase.auth.verifyOtp({ token_hash, type: 'email' })`を呼んで検証する（クロスデバイスで動作させるため、Supabase推奨の`token_hash`方式を採用。詳細は5章） |
| サインアップ直後のログイン状態 | `POST /auth/sign-up`が`session_token`を返しCookieがセットされるため、待機画面表示時点で「メール未確認のログイン中ユーザー」 | `POST /auth/sign-up`はSupabase Admin API経由でユーザーを作成するのみでセッションは発行しない（[AUTH-DESIGN.md](../../AUTH-DESIGN.md)参照）。**待機画面表示時点ではフロントは未ログイン**。セッション確認（`GET /auth/session`相当）には依存できない |
| 待機画面でのメールアドレス表示 | `GET /auth/session`の`user.email`から取得 | サインアップフォームから渡された値を保持して表示（未ログインのためセッションAPIを呼べない。6章参照） |
| 再送信 | `POST /auth/send-verification-email`（自社API） | `supabase.auth.resend({ type: 'signup', email })`（フロントから直接Supabase Authを呼ぶ） |
| トークン有効期限 | Better Authデフォルト1時間→`emailVerification.expiresIn: 86400`で24時間に変更 | Supabase Authデフォルトも1時間（`MAILER_OTP_EXP`）→Supabaseダッシュボード（Authentication > Email）側の設定で24時間（86400秒）に変更 |
| 失敗時のエラー種別 | `callbackURL?error=TOKEN_EXPIRED\|INVALID_TOKEN\|USER_NOT_FOUND` | `verifyOtp()`が返す`AuthError`。期限切れは`otp_expired`を確認済み。それ以外のエラーコードの網羅は実装時に要確認（4章参照） |

---

## 1. 目的・ゴール

| 項目 | 内容 |
|---|---|
| 画面の役割 | メールアドレスの実在確認を行い、未確認ユーザーをダッシュボード利用可能な状態にする |
| 完了条件 | メール確認が完了し、Supabase Auth側で`email_confirmed_at`が設定された状態でサインインし、`/clock` へ到達する |
| 離脱防止方針 | 「何をすればいいか」「メールが来ない時どうするか」を常に画面上に明示する |

---

## 2. 画面パターンと遷移

```
[/signup] 送信成功（core.tenants・core.users・Supabase Auth側のユーザー作成が完了。セッションは無い）
   ↓ router.push('/verify-email?email=admin@example.com')
     ※パスワードは渡さない。メールアドレスのみクエリ経由で待機画面に引き継ぐ
[/verify-email]（パターンA：待機。token_hashクエリ無し）
   - URLクエリの email を表示（3.1参照）
   - [確認メールを再送信] ボタン → supabase.auth.resend({ type: 'signup', email })
   ↓（別タブ／別デバイスでメールを開きリンクをクリック）
メール内リンクは apps/web の /verify-email を直接指す（Supabase側のホストエンドポイントは経由しない設定にする）
   例: {WEB_URL}/verify-email?token_hash=pkce_xxxxx&type=email
   ↓
[/verify-email]（パターンB：結果表示。token_hashクエリあり）
   - ページマウント時にフロントが supabase.auth.verifyOtp({ token_hash, type: 'email' }) を呼ぶ
   - 成功 → セッション確立（SDKが内部でaccess_token/refresh_tokenを保持）→ verified表示
   - 失敗（otp_expired等） → 対応するエラー状態を表示
```

**パターンAの画面を開いたままリンクをクリックした場合**（同一タブ運用）：リンクが`/verify-email`自身を指す（クエリだけ変わる）ため、Next.jsのクライアントサイドルーティングでは検知できずブラウザの通常ナビゲーションとして扱われる。ページは再マウントされ、`token_hash`クエリの有無で改めてA/Bの分岐に入る（v1.0と挙動は同じ）。

**別タブでリンクを開いた場合**（一般的な運用、確定仕様）：v1.0では`GET /auth/session`のポーリング代替として`focus`イベントで再取得していたが、v2.0では待機画面がそもそも未ログイン・セッション非依存（0章参照）のため、**フォーカス時の自動再取得は行わない**。別タブでの確認完了後、ユーザー自身が元のタブに戻って「ログインへ進む」等の導線を明示的に押す設計に変更する（4章参照）。

---

## 3. レイアウト構成

`/login` `/signup` と同一の中央寄せ単一カード構成を踏襲する（v1.0から変更なし）。

### 3.1 パターンA（待機）

```
┌─────────────────────────────────────┐
│  [ロゴ] KintaiHub                     │
│                                       │
│  ┌─────────────────────────────┐    │
│  │        ✉（封筒アイコン）      │    │
│  │                               │    │
│  │  確認メールを送信しました       │    │ ← 見出し
│  │                               │    │
│  │  admin@example.com 宛に        │    │ ← URLクエリの email から表示
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

v1.0とは異なり、**検証（`verifyOtp`呼び出し）自体をこのページが行う**ため、「確認しています…」はネットワーク往復を伴う実質的な処理中状態になる（v1.0はセッション確認のみの一瞬の表示だった）。

```
┌─────────────────────────────┐
│      ⏳ / ✅ / ⚠️              │ ← 状態に応じたアイコン
│                               │
│  確認しています…              │ ← verifyOtp応答待ち
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
| `waiting`（待機） | `token_hash`クエリ無し | 3.1のレイアウト。`email`クエリが無い場合は「ご登録のメールアドレス宛に」とフォールバック表示（9章） | 「確認メールを再送信」 |
| `resending` | 再送信ボタン押下中 | ボタンを「送信中...」+ disabled | — |
| `resent` | 再送信成功 | ボタン下に「再送信しました」（`text-green-600`） | 「確認メールを再送信」（再度押下可、7章のクールダウンに従う） |
| `checking`（検証中） | `token_hash`クエリあり、`verifyOtp`応答待ち | スピナー＋「確認しています…」 | なし |
| `verified`（成功） | `verifyOtp`成功 | ✅＋「メール認証が完了しました」 | 「ダッシュボードへ進む」（`/clock`。5章の通りverifyOtp成功時点でセッションは確立済み） |
| `expired`（期限切れ） | `verifyOtp`失敗、エラーコード`otp_expired` | ⚠️＋「リンクの有効期限が切れています」 | 「確認メールを再送信」（このボタンから再送信する場合、emailはURLクエリではなく画面上の入力欄で受け取る。9章参照） |
| `invalid`（不正トークン） | `verifyOtp`失敗、`otp_expired`以外のエラー | ⚠️＋「無効なリンクです」 | 「ログイン画面へ」（`/login`） |

**要確認（実装時）**: `verifyOtp`が返す`AuthError`のうち`otp_expired`は確認済みだが、トークンが存在しない・既に使用済み等の他のケースで具体的にどのエラーコード／メッセージが返るかはSupabase側の挙動を実装時に確認し、`expired`/`invalid`の判定ロジックを確定させる。`already_verified`（既に確認済みのリンクを再度踏んだ場合）を`invalid`と`verified`のどちらに倒すかも合わせて確認する。

---

## 5. API連携

メール確認はSupabase Auth標準機能（`verifyOtp`）に委譲する。カスタムAPIは実装しない。

| 呼び出し | 概要 | フロントの呼び方 |
|---|---|---|
| `supabase.auth.verifyOtp({ token_hash, type: 'email' })` | メールリンクのtoken_hashを検証し、成功時はセッション（access_token/refresh_token）をSDK内部に確立する | パターンBのページマウント時に自動実行 |
| `supabase.auth.resend({ type: 'signup', email })` | 確認メールの再送信 | 再送信ボタンから呼ぶ |

**実装上の前提設定（Supabaseプロジェクト側）**

- Email Templates（Authentication > Email Templates > Confirm signup）のリンクを、Supabase既定のホスト型検証URLではなく`{WEB_URL}/verify-email?token_hash={{ .TokenHash }}&type=email`を指す形式にカスタマイズする必要がある（クロスデバイスで動作する`token_hash`方式を使うため。0章の変更点表を参照）。
- トークン有効期限：Authentication > Email設定の`MAILER_OTP_EXP`相当の項目で24時間（86400秒）に変更する（デフォルトはBetter Auth同様1時間のため、変更しないと要件を満たさない）。
- カスタムSMTP（Resend）の設定が必須（デフォルトのSupabase組み込みSMTPは2通/時間の制限があり本番不可。`TECH-STACK.md`参照）。
- `POST /auth/sign-up`（apps/api）はサインアップ完了時点でセッションを発行しないため、パターンAの待機画面は非ログイン状態で表示される前提でよい（0章参照）。

---

## 6. 送信・検証フロー

### パターンA：初期表示・再送信

```
ページマウント（URLに token_hash クエリ無し）
   ↓
URLクエリの email を読み取り画面に表示（無ければフォールバック文言）
   ↓
waiting 状態で表示（v1.0と異なりセッション確認は行わない）

「確認メールを再送信」クリック
   ↓
ボタンを「送信中...」+ disabled
   ↓
supabase.auth.resend({ type: 'signup', email })
   ↓（成功）「再送信しました」表示、7章のクールダウン開始
   ↓（失敗。レート制限・ネットワークエラー等）「送信に失敗しました。時間をおいて再度お試しください」+ 7章のクールダウン開始（連打防止）
```

### パターンB：メールリンク経由での着地

```
メール内リンククリック（ブラウザは apps/web の /verify-email へ直接遷移。token_hash・type をクエリに含む）
   ↓
Next.jsの/verify-emailページがマウント
   ↓（token_hashクエリあり）
checking に遷移
   ↓
supabase.auth.verifyOtp({ token_hash, type: 'email' }) を実行
   ↓（成功）verified に遷移（セッション確立済み）
   ↓（失敗・otp_expired）expired に遷移
   ↓（失敗・その他）invalid に遷移
```

---

## 7. 再送信のレート制限

`api-spec.md`共通仕様（認証エンドポイント: 10req/min）はapps/api向けの規定であり、`supabase.auth.resend()`はSupabase Auth側のレート制限（既定30req/5分・IPごと。詳細は`AUTH-DESIGN.md`関連の調査内容を参照）に従う。UX上はv1.0同様、フロント側でもクールダウンを設ける。

- 再送信ボタンは1回押下後 **60秒間disabled**（連打防止、サーバー側レート制限に頼りきらない）
- このクールダウンは送信成功時だけでなく、失敗時にも同様に適用する
- 失敗時のエラーメッセージは次にボタンを押す（＝クールダウン終了後の再送信）まで表示し続ける
- disabled中はボタンラベルに残り秒数を表示：「再送信（あと45秒）」

---

## 8. デザイントーン

`/login` `/signup` と統一（[top-page-design.md 7章](./top-page-design.md#7-デザイントーンuiガイドライン)と同一基準）。v1.0から変更なし。

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
- **待機画面（パターンA）のメールアドレス表示はURLクエリ由来**であり、直接URLアクセス等でクエリが無い場合は空表示にならないよう、フォールバック文言「ご登録のメールアドレス宛に」を用意する（v1.0はセッション取得失敗時のフォールバックだったが、v2.0はそもそも未ログイン前提のため常にこのフォールバックを考慮する必要がある）
- `expired`状態からの再送信は、待機画面と異なりURLクエリにemailが無い可能性がある（メールリンクを踏んだ結果の遷移のため）。再送信用にメールアドレス入力欄を画面内に設けるか、`token_hash`検証失敗時のレスポンスからメールアドレスを復元できるか実装時に確認する

---

## 10. 今後の検討事項（未確定）

- 確認メール自体の文面・送信元設定（Resend連携、Supabase側のメールテンプレート機能で設定）：11章に草案を作成済みだが、送信元ドメイン・法務文言・最終コピーは未承認
- 4章「要確認」に記載した`verifyOtp`の詳細なエラーコード網羅
- 9章「要確認」に記載した`expired`状態からの再送信時のメールアドレス取得方法

**決定済み（このドキュメント外にも反映）**

- メール確認方式：Supabase Auth標準機能（`verifyOtp` + `token_hash`）に委譲（0章・5章に反映）
- トークン有効期限：24時間（Supabaseダッシュボードでの設定変更が必要。5章に反映）
- メール確認未完了ユーザーが `/clock` 等へアクセスした場合のガード方針：「メールが未確認です」というブロッキングメッセージを表示する。詳細は [ui-permissions.md](../ui-permissions.md) の「未確認（メール未認証）ユーザーの挙動」を参照（v1.0から変更なし）
- 別タブでリンクを開いた場合の待機タブ（パターンA）：v2.0では自動更新（フォーカス時再取得）を廃止し、ユーザー自身の明示的な操作に委ねる（2章に反映）

---

## 11. 確認メール文面（草案・未承認）

送信元ドメイン・法務文言・最終コピーは未確定のため、実装着手前に要承認。Supabase Authのメールテンプレート（Authentication > Email Templates > Confirm signup）に設定する内容の草案として以下を提案する。

| 項目 | 値（草案） |
|---|---|
| 送信元表示名 | KintaiHub |
| 送信元アドレス | `no-reply@（送信ドメイン未確定）` |
| 件名 | 【KintaiHub】メールアドレスの確認をお願いします |

**本文（草案）**

```
{{ .Data.name }} 様

KintaiHubにご登録いただきありがとうございます。
以下のリンクをクリックして、メールアドレスの確認を完了してください。

{{ .SiteURL }}/verify-email?token_hash={{ .TokenHash }}&type=email

※このリンクの有効期限は24時間です。期限が切れた場合は、
　サインアップ画面またはログイン後の画面から再送信してください。

※このメールにお心当たりがない場合は、破棄していただいて構いません。
　お客様のメールアドレスが誤って入力された可能性があります。

--
KintaiHub
（フッター：会社情報・配信停止に関する記載は要法務確認。10章の法務コンテンツ整備待ち）
```

- リンクはSupabase Authのメールテンプレート変数（`{{ .SiteURL }}`, `{{ .TokenHash }}`）で構成し、Supabase既定のホスト型検証URLではなく`apps/web`の`/verify-email`を直接指す形にカスタマイズする（5章参照）
- HTML版のデザイン（ロゴ・ボタン化されたリンク等）は本草案では未定義。まずプレーンテキスト相当の内容で実装し、デザイン適用は別途
- 送信元ドメインはResendでのドメイン認証（SPF/DKIM）が必要。ドメイン未確定のため実装時はResendのテストドメインで仮運用し、確定後に切り替える
