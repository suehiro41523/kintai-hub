import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { workTypes } from './schema/app.js'
import { departments, tenants, users } from './schema/core.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client)

// スタブで使用していた固定ID（auth ミドルウェアと一致させる）
const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const USER_ID = '00000000-0000-0000-0000-000000000002'
const DEPT_ID = '00000000-0000-0000-0000-000000000003'

await db.transaction(async (tx) => {
  await tx
    .insert(tenants)
    .values({
      id: TENANT_ID,
      name: 'テスト株式会社',
      plan: 'standard',
      status: 'active',
      maxUsers: 100,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    })
    .onConflictDoNothing()

  await tx
    .insert(departments)
    .values({
      id: DEPT_ID,
      tenantId: TENANT_ID,
      name: '開発部',
      sortOrder: 1,
      createdAt: new Date('2026-01-01'),
    })
    .onConflictDoNothing()

  await tx
    .insert(users)
    .values({
      id: USER_ID,
      tenantId: TENANT_ID,
      departmentId: DEPT_ID,
      name: '田中太郎',
      email: 'tanaka@test.example.com',
      role: 'employee',
      employmentType: 'full_time',
      isActive: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    })
    .onConflictDoNothing()

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
        createdAt: new Date('2026-01-01'),
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
        createdAt: new Date('2026-01-01'),
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
        createdAt: new Date('2026-01-01'),
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
        createdAt: new Date('2026-01-01'),
      },
    ])
    .onConflictDoNothing()
})

console.log('Seed complete')
await client.end()
