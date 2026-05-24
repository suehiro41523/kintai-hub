import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as appSchema from './schema/app.js'
import * as coreSchema from './schema/core.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const client = postgres(databaseUrl)

export const db = drizzle(client, {
  schema: { ...coreSchema, ...appSchema },
})
