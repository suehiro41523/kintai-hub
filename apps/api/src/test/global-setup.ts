import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { TEST_DATABASE_NAME, TEST_DATABASE_URL } from './database-url.js'

// テスト実行前に1回だけ呼ばれる。テスト用DBが無ければ作成し、マイグレーションを最新まで適用する。
// テストデータはテストごとに新しいテナントを作って分離するため、ここでは削除しない
export default async function setup(): Promise<void> {
  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = '/postgres'
  const adminClient = postgres(adminUrl.toString(), { max: 1 })
  try {
    const existing = await adminClient`
      SELECT 1 FROM pg_database WHERE datname = ${TEST_DATABASE_NAME}
    `
    if (existing.length === 0) {
      await adminClient.unsafe(`CREATE DATABASE "${TEST_DATABASE_NAME}"`)
    }
  } finally {
    await adminClient.end()
  }

  const client = postgres(TEST_DATABASE_URL, { max: 1 })
  try {
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('../db/migrations', import.meta.url)),
    })
  } finally {
    await client.end()
  }
}
