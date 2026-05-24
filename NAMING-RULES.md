# NAMING-RULES.md — ファイル・変数命名規則

Next.js App Router プロジェクトにおける命名規則です。

---

## まとめ

| カテゴリ | ケース | 例 |
|---|---|---|
| URL になるもの（ページ・ディレクトリ） | ケバブケース | `work-types/`, `[post-id]/` |
| コンポーネントファイル | パスカルケース | `Sidebar.tsx`, `UserCard.tsx` |
| カスタムフックファイル | キャメルケース（`use` prefix） | `useClock.ts`, `useBilling.ts` |
| ユーティリティ・型定義ファイル | キャメルケース | `apiClient.ts`, `fetcher.ts` |
| 関数・変数 | キャメルケース | `formatDate`, `createPost` |
| 型・インターフェース | パスカルケース | `WorkType`, `BillingContract` |
| 定数・環境変数 | スネークケース大文字 | `MAX_RETRY_COUNT`, `NEXT_PUBLIC_API_URL` |

> **覚え方**: URL に出るものはケバブ、React コンポーネントはパスカル、それ以外はキャメル

---

## ディレクトリ・ファイル（ルーティング関連）

| 対象 | ケース | 例 |
|---|---|---|
| ページ・ルートディレクトリ | ケバブケース | `user-profile/`, `work-types/` |
| 動的ルート | ケバブケース | `[post-id]/`, `[user-name]/` |
| ルートグループ | ケバブケース | `(auth-layout)/`, `(dashboard)/` |
| 特殊ファイル | 固定 | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` |

## コンポーネント

| 対象 | ケース | 例 |
|---|---|---|
| コンポーネントファイル | パスカルケース | `Sidebar.tsx`, `UserCard.tsx` |
| コンポーネント関数名 | パスカルケース | `export default function UserCard()` |
| Server Components | パスカルケース（区別なし） | `DashboardLayout.tsx` |
| Client Components | パスカルケース + `'use client'` | `SearchInput.tsx` |

## フック・ユーティリティ

| 対象 | ケース | 例 |
|---|---|---|
| カスタムフックファイル | キャメルケース（`use` prefix） | `useClock.ts`, `useBilling.ts` |
| カスタムフック関数名 | キャメルケース（`use` prefix） | `useAuth`, `useFetchUser` |
| ユーティリティファイル | キャメルケース | `apiClient.ts`, `fetcher.ts` |
| 型定義ファイル | キャメルケース | `userTypes.ts` |

## 関数・変数・型

| 対象 | ケース | 例 |
|---|---|---|
| Server Actions | キャメルケース | `createPost`, `deleteUser` |
| ユーティリティ関数 | キャメルケース | `formatDate`, `fetcher` |
| 型・インターフェース | パスカルケース | `UserProfile`, `BlogPost` |
| 定数 | スネークケース大文字 | `MAX_RETRY_COUNT` |
| 環境変数 | スネークケース大文字 | `NEXT_PUBLIC_API_URL` |

---

## ディレクトリ構成例

```
app/
├── (dashboard)/               # ルートグループ：ケバブケース
│   ├── work-types/            # ページ：ケバブケース
│   │   └── page.tsx
│   └── [record-id]/           # 動的ルート：ケバブケース
│       └── page.tsx
components/
├── layout/
│   └── Sidebar.tsx            # コンポーネント：パスカルケース
hooks/
├── useClock.ts                # カスタムフック：キャメルケース
└── useBilling.ts
lib/
└── apiClient.ts               # ユーティリティ：キャメルケース
providers/
└── QueryProvider.tsx          # コンポーネント：パスカルケース
```
