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

`insertAuditLog()`（`apps/api/src/db/queries/audit-logs.ts`）を使い、**業務データの更新と同じトランザクション（`tx`）で**書き込む。
操作者の情報はルートで `getAuditActor(c)`（`apps/api/src/lib/audit.ts`）から取り出してクエリ関数に渡す。

```typescript
// INSERT のみ。UPDATE / DELETE は禁止（DB側でも kintai_app ロールの権限で禁止している）
return db.transaction(async (tx) => {
  const [updated] = await tx.update(timeRecords).set({ ... }).where(...).returning()
  await insertAuditLog(tx, {
    tenantId,
    actor,                       // { userId, ipAddress, userAgent }
    action: 'update',
    resourceType: 'time_record',
    resourceId: id,
    beforeValue: { clockedAt: existing.clockedAt },  // オブジェクトのまま渡す（JSON.stringifyしない）
    afterValue: { clockedAt: updated.clockedAt },
  })
  return updated
})
```

現在記録している操作：打刻修正（`time_record` / `update`）、申請の承認・却下（`request` / `approve`・`reject`）、従業員の更新・無効化（`user` / `update`・`deactivate`）
