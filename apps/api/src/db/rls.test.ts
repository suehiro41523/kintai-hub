import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestTenant, type TestTenant } from '../test/helpers.js'
import { db, withTenantTransaction } from './index.js'
import { billingContracts, billingSummaries, workTypes } from './schema/app.js'

describe('RLSによるテナント分離', () => {
  let tenant: TestTenant
  let otherTenant: TestTenant

  beforeEach(async () => {
    tenant = await createTestTenant()
    otherTenant = await createTestTenant()
  })

  it('tenant_id列を持つappスキーマの全テーブルで、RLSとtenant_isolationポリシーが有効になっている', async () => {
    const rows = await db.execute<{ table_name: string; rls: boolean; has_policy: boolean }>(sql`
      SELECT c.relname AS table_name,
             c.relrowsecurity AS rls,
             EXISTS (
               SELECT 1 FROM pg_policies p
               WHERE p.schemaname = 'app' AND p.tablename = c.relname AND p.policyname = 'tenant_isolation'
             ) AS has_policy
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN information_schema.columns col
        ON col.table_schema = n.nspname AND col.table_name = c.relname AND col.column_name = 'tenant_id'
      WHERE n.nspname = 'app' AND c.relkind = 'r'
    `)

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row, row.table_name).toMatchObject({ rls: true, has_policy: true })
    }
  })

  it('WHERE tenant_id を付けないクエリでも、他テナントの行は返らない', async () => {
    const result = await withTenantTransaction(tenant.tenantId, async () => ({
      workTypes: await db.select({ tenantId: workTypes.tenantId }).from(workTypes),
      contracts: await db.select({ tenantId: billingContracts.tenantId }).from(billingContracts),
      summaries: await db.select({ tenantId: billingSummaries.tenantId }).from(billingSummaries),
    }))

    for (const rows of Object.values(result)) {
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.tenantId === tenant.tenantId)).toBe(true)
    }
  })

  it('他テナントのtenant_idを指定した行は書き込めない', async () => {
    const insertOtherTenantRow = withTenantTransaction(tenant.tenantId, () =>
      db.insert(workTypes).values({
        id: randomUUID(),
        tenantId: otherTenant.tenantId,
        name: '不正な書き込み',
        color: '#000000',
        billingType: 'hourly',
      }),
    )

    await expect(insertOtherTenantRow).rejects.toThrow()
  })

  it('テナントを設定していない場合は、appスキーマの行が1件も返らない', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE kintai_app`)
      return tx.select({ id: workTypes.id }).from(workTypes)
    })

    expect(rows).toEqual([])
  })

  it.each(['', 'not-a-uuid'])('tenantIdがUUIDの形式でない場合(%j)は、クエリを実行せず例外にする', async (tenantId) => {
    await expect(withTenantTransaction(tenantId, () => db.select().from(workTypes))).rejects.toThrow(
      'tenantIdがUUIDの形式ではありません',
    )
  })
})
