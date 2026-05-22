# DB-PATTERNS.md — Drizzle ORM クエリパターン

## 基本クエリ

```typescript
import { db } from '../../db'
import { timeRecords } from '../../db/schema/app'
import { eq, and, gte, lte } from 'drizzle-orm'

// ✅ 正しい書き方（tenant_idを必ず入れる）
const records = await db
  .select({
    id: timeRecords.id,
    clockedAt: timeRecords.clockedAt,
    recordType: timeRecords.recordType,
    workTypeId: timeRecords.workTypeId,
  })
  .from(timeRecords)
  .where(
    and(
      eq(timeRecords.userId, userId),
      eq(timeRecords.tenantId, tenantId),  // 必ず入れる
      gte(timeRecords.clockedAt, from),
      lte(timeRecords.clockedAt, to)
    )
  )

// ❌ 悪い書き方
const records = await db.select().from(timeRecords)  // SELECT * も tenant_id省略も禁止
```

## INSERT

```typescript
const [record] = await db
  .insert(timeRecords)
  .values({
    id: randomUUID(),
    userId,
    tenantId,
    workTypeId,
    recordType: 'clock_in',
    clockedAt: new Date(),
    deviceType,
    locationLat,
    locationLng,
    isModified: false,
    createdAt: new Date(),
  })
  .returning()
```

## トランザクション

```typescript
// 複数テーブルへの書き込みは必ずトランザクションで
const result = await db.transaction(async (tx) => {
  // ワークタイプ切替: clock-out → clock-in
  const [clockOut] = await tx
    .insert(timeRecords)
    .values({ ...clockOutData })
    .returning()

  const [clockIn] = await tx
    .insert(timeRecords)
    .values({ ...clockInData })
    .returning()

  return { clockOut, clockIn }
})
```

## テナント登録（複数テーブル一括）

```typescript
// テナント作成は必ずトランザクションで（途中失敗で不完全なデータが残らないよう）
await db.transaction(async (tx) => {
  const [tenant] = await tx.insert(tenants).values({ ... }).returning()
  const [user]   = await tx.insert(users).values({ tenantId: tenant.id, role: 'admin', ... }).returning()
  await tx.insert(workTypes).values(defaultWorkTypes(tenant.id))  // デフォルトワークタイプ
})
```

## スキーマ定義のサンプル

```typescript
// apps/api/src/db/schema/app.ts
import { pgTable, uuid, varchar, boolean, integer, timestamp, decimal } from 'drizzle-orm/pg-core'
import { pgSchema } from 'drizzle-orm/pg-core'

const appSchema = pgSchema('app')

export const workTypes = appSchema.table('work_types', {
  id:          uuid('id').primaryKey(),
  tenantId:    uuid('tenant_id').notNull(),
  name:        varchar('name', { length: 100 }).notNull(),
  color:       varchar('color', { length: 7 }).notNull(),
  billingType: varchar('billing_type', { length: 50 }).notNull(),
  isBillable:  boolean('is_billable').notNull().default(true),
  isActive:    boolean('is_active').notNull().default(true),
  sortOrder:   integer('sort_order').notNull().default(0),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

## audit_logs への書き込み

```typescript
// INSERT のみ。UPDATE / DELETE は禁止
await db.insert(auditLogs).values({
  id:           randomUUID(),
  tenantId,
  userId,
  action:       'update',
  resourceType: 'time_record',
  resourceId:   recordId,
  beforeValue:  JSON.stringify(before),
  afterValue:   JSON.stringify(after),
  ipAddress:    c.req.header('x-forwarded-for'),
  createdAt:    new Date(),
})
```
