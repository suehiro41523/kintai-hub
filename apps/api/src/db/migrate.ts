import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client)

await migrate(db, { migrationsFolder: './src/db/migrations' })

console.log('Migration complete')
await client.end()
