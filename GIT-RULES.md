# GIT-RULES.md — ブランチ運用ルール

ブランチの切り方からmainへの取り込み、マージ後の後片付けまでのルールです。

---

## まとめ

| 項目 | ルール |
|---|---|
| mainへの取り込み | PR経由のみ。mainへの直接pushは禁止（ブランチ保護で拒否される） |
| ブランチの起点 | 最新のmainから切る |
| ブランチ名 | `<type>/<英語ケバブケース>` |
| マージ方式 | 指定なし（merge・squash・rebaseのどれでもよい） |
| マージ後 | ブランチを削除する（リモートは自動削除、ローカルは手動） |

---

## ブランチ名

`<type>/<英語ケバブケース>` の形式にします。後半には変更内容が分かる英語の短い説明を書きます。

| type | 用途 | 例 |
|---|---|---|
| `feat` | 機能追加 | `feat/web-cloudflare-workers` |
| `fix` | バグ修正 | `fix/cors-multiple-frontend-origins` |
| `docs` | ドキュメントのみの変更 | `docs/git-branch-rules` |
| `refactor` | 振る舞いを変えないコード整理 | `refactor/billing-queries` |
| `chore` | ビルド・依存関係・設定など | `chore/migrate-to-npm` |

- 1つのブランチでは1つの目的（基本は1つのissue）だけを扱う
- 日本語・大文字・アンダースコアは使わない

## 作業の流れ

```bash
git switch main
git pull --ff-only
git switch -c <type>/<説明>

# 作業・コミット

git push -u origin <type>/<説明>
gh pr create --base main
```

1. 最新のmainからブランチを切る
2. 作業してコミットし、pushしてPRを作る。issueに対応するPRは、本文に `Closes #<番号>` を書く
3. PRをマージする

## mainのブランチ保護

GitHubのRuleset（Settings → Rules → Rulesets の `main`）で、デフォルトブランチ（main）に次の設定をしています。

- PRを経由しない変更を禁止する（直接pushは拒否される）
- 承認（Approve）は必須にしない（開発者が1人のため、必須にすると自分のPRをマージできなくなる）
- force pushとブランチの削除を禁止する
- Bypass listは空にして、管理者にも同じ制限をかける

## マージ後の後片付け

- **リモート：** リポジトリ設定の「Automatically delete head branches」を有効にしているため、PRをマージするとリモートのブランチは自動で削除される
- **ローカル：** 自動では消えないため、マージ後に削除する

```bash
git switch main
git pull --ff-only
git fetch --prune                 # リモートで削除済みのブランチの追跡情報を消す
git branch -d <type>/<説明>       # マージ済みでなければ失敗するので、未マージの削除事故を防げる
```

squash・rebaseでマージした場合は、元のコミットがmainに残らないため `-d` が「未マージ」と判定して失敗します。GitHub上でPRがマージ済みであることを確認してから `git branch -D` で削除してください。

PRをマージせずにクローズしたブランチは、自動では削除されません。不要になったら手動で削除してください。
