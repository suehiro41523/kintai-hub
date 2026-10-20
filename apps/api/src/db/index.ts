import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as appSchema from './schema/app.js'
import * as coreSchema from './schema/core.js'

const schema = { ...coreSchema, ...appSchema }
type Schema = typeof schema
type Db = PostgresJsDatabase<Schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

let instance: Db | undefined

// ローカル開発(Node, DATABASE_URLから直接接続)とCloudflare Workers(Hyperdriveバインディング経由)の
// 両方から呼ばれる。同一プロセス/同一Workerアイソレート内では最初の呼び出しだけが実際に接続し、
// 以降は使い回す(詳細はTECH-STACK.md「Cloudflareへの移行に伴うランタイム変更」参照)
export function initDb(connectionString: string): void {
  if (instance) return
  const client = postgres(connectionString)
  instance = drizzle(client, { schema })
}

function requireDb(): Db {
  if (!instance) {
    throw new Error('DBが初期化されていません。initDb()をリクエスト処理前に呼び出してください')
  }
  return instance
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// withTenantTransaction の実行中は、そのトランザクションを保持する
const tenantTxStorage = new AsyncLocalStorage<Tx>()

// 既存コードが `db.select()` 等をそのまま呼べるよう、実体解決を遅延させるProxy。
// withTenantTransaction の中ではテナントのトランザクションに、外では通常の接続に解決する。
// メソッドは実体にbindして返す(内部でprivateフィールドを使うクラスをProxy経由で
// 呼ぶと `this` がProxy自身になり例外になるため)
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = tenantTxStorage.getStore() ?? requireDb()
    const value = Reflect.get(real, prop)
    return typeof value === 'function' ? value.bind(real) : value
  },
})

// fn 内の `db` 経由のクエリを、すべてRLSが効く1つのトランザクションで実行する。
// set_config の第3引数 true(トランザクションローカル)はトランザクションの外では即座に消えるため、
// クエリ全体を同じトランザクションに入れないとRLSのテナント条件が効かない。
// また接続ユーザー(スーパーユーザーやテーブル所有者)はRLSを無視するため、
// RLS適用対象のロール kintai_app に切り替える(AUTH-DESIGN.md「RLSポリシー」参照)
export async function withTenantTransaction<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  // 不正なtenantIdでもRLSは0行を返すだけでエラーにならないため、呼び出し側のバグをここで例外にして気づけるようにする
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error(`tenantIdがUUIDの形式ではありません: "${tenantId}"`)
  }
  return requireDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE kintai_app`)
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`)
    return tenantTxStorage.run(tx, () => fn(tx))
  })
}
