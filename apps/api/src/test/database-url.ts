// テスト用DBの接続先。docker-compose.yml のPostgreSQLに、開発用DB(kintai_hub)とは別の
// kintai_hub_test を作って使う。TEST_DATABASE_URL で上書きできる
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://kintai:kintai_pass@localhost:5432/kintai_hub_test'

const databaseName = new URL(TEST_DATABASE_URL).pathname.slice(1)

// 開発用・本番用のDBを誤って指定し、テストデータを書き込んでしまう事故を防ぐ
if (!databaseName.endsWith('_test')) {
  throw new Error(
    `TEST_DATABASE_URL のDB名は _test で終わる必要があります（指定値: ${databaseName}）`,
  )
}

export const TEST_DATABASE_NAME = databaseName
