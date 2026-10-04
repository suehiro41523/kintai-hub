import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { workTypes } from './schema/app.js'
import { departments, tenants, users } from './schema/core.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl) throw new Error('SUPABASE_URL is not set')
if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client)

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const DEPT_ID = '00000000-0000-0000-0000-000000000003'

const ADMIN_EMAIL = process.env.TEST_EMAIL ?? 'admin@example.com'
const ADMIN_PASSWORD = process.env.TEST_PASSWORD ?? 'password'
const ADMIN_USER_ID = randomUUID()

const now = new Date('2026-01-01')

// Supabase Auth側にテストユーザーを作成する（email_confirm: trueでメール確認をスキップ）。
// 再実行時は既に存在するため、メールアドレスで検索して既存ユーザーのidを使う（冪等性のため）
async function ensureSupabaseTestUser(): Promise<string> {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  })
  if (created?.user) return created.user.id

  let page = 1
  for (;;) {
    const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (listError) throw listError
    const existingUser = listed.users.find((u) => u.email === ADMIN_EMAIL)
    if (existingUser) return existingUser.id
    if (listed.users.length < 200) break
    page += 1
  }
  throw error ?? new Error(`Supabaseテストユーザーの作成に失敗しました: ${ADMIN_EMAIL}`)
}

const authUserId = await ensureSupabaseTestUser()

await db.transaction(async (tx) => {
  // テナント
  await tx
    .insert(tenants)
    .values({
      id: TENANT_ID,
      name: 'テスト株式会社',
      plan: 'standard',
      status: 'active',
      maxUsers: 100,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()

  // 部署
  await tx
    .insert(departments)
    .values({
      id: DEPT_ID,
      tenantId: TENANT_ID,
      name: '開発部',
      sortOrder: 1,
      createdAt: now,
    })
    .onConflictDoNothing()

  // ワークタイプ
  await tx
    .insert(workTypes)
    .values([
      {
        id: '10000000-0000-0000-0000-000000000001',
        tenantId: TENANT_ID,
        name: '原籍業務',
        color: '#64748b',
        billingType: 'fixed',
        isBillable: false,
        isActive: true,
        sortOrder: 1,
        createdAt: now,
      },
      {
        id: '10000000-0000-0000-0000-000000000002',
        tenantId: TENANT_ID,
        name: '客先A（○○社）',
        color: '#22c55e',
        billingType: 'range',
        isBillable: true,
        isActive: true,
        sortOrder: 2,
        createdAt: now,
      },
      {
        id: '10000000-0000-0000-0000-000000000003',
        tenantId: TENANT_ID,
        name: '客先B（△△社）',
        color: '#3b82f6',
        billingType: 'hourly',
        isBillable: true,
        isActive: true,
        sortOrder: 3,
        createdAt: now,
      },
      {
        id: '10000000-0000-0000-0000-000000000004',
        tenantId: TENANT_ID,
        name: '研修・教育',
        color: '#f59e0b',
        billingType: 'fixed',
        isBillable: false,
        isActive: true,
        sortOrder: 4,
        createdAt: now,
      },
    ])
    .onConflictDoNothing()

  // core.users（業務データ）。Supabase Auth側のユーザー作成はトランザクション外で完了済み
  await tx
    .insert(users)
    .values({
      id: ADMIN_USER_ID,
      tenantId: TENANT_ID,
      departmentId: DEPT_ID,
      authUserId,
      name: '管理者',
      email: ADMIN_EMAIL,
      role: 'admin',
      employmentType: 'full_time',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
})

console.log(`Seed complete: 管理者ユーザー ${ADMIN_EMAIL} を作成しました`)
await client.end()
