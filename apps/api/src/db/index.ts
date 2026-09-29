import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as appSchema from './schema/app.js'
import * as coreSchema from './schema/core.js'

const schema = { ...coreSchema, ...appSchema }
type Schema = typeof schema
type Db = PostgresJsDatabase<Schema>

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

// 既存コードが `db.select()` 等をそのまま呼べるよう、実体解決を遅延させるProxy。
// メソッドは実体にbindして返す(内部でprivateフィールドを使うクラスをProxy経由で
// 呼ぶと `this` がProxy自身になり例外になるため)
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = requireDb()
    const value = Reflect.get(real, prop)
    return typeof value === 'function' ? value.bind(real) : value
  },
})
