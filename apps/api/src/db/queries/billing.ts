import { randomUUID } from 'node:crypto'
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { RecordType } from '../../types.js'
import { db } from '../index.js'
import { billingContracts, billingSummaries, timeRecords } from '../schema/app.js'

// ─── 型定義 ───────────────────────────────────────────────────────────────────

type BillingContractRow = typeof billingContracts.$inferSelect
type BillingSummaryRow = typeof billingSummaries.$inferSelect

export type MappedBillingContract = Omit<
  BillingContractRow,
  'minHours' | 'maxHours' | 'baseAmount' | 'overRate' | 'underRate'
> & {
  minHours: number | null
  maxHours: number | null
  baseAmount: number | null
  overRate: number | null
  underRate: number | null
}

export type MappedBillingSummary = Omit<
  BillingSummaryRow,
  'actualHours' | 'billingHours' | 'overHours' | 'underHours' | 'billingAmount'
> & {
  actualHours: number
  billingHours: number
  overHours: number | null
  underHours: number | null
  billingAmount: number
}

function mapContract(row: BillingContractRow): MappedBillingContract {
  return {
    ...row,
    minHours: row.minHours !== null ? Number(row.minHours) : null,
    maxHours: row.maxHours !== null ? Number(row.maxHours) : null,
    baseAmount: row.baseAmount !== null ? Number(row.baseAmount) : null,
    overRate: row.overRate !== null ? Number(row.overRate) : null,
    underRate: row.underRate !== null ? Number(row.underRate) : null,
  }
}

function mapSummary(row: BillingSummaryRow): MappedBillingSummary {
  return {
    ...row,
    actualHours: Number(row.actualHours),
    billingHours: Number(row.billingHours),
    overHours: row.overHours !== null ? Number(row.overHours) : null,
    underHours: row.underHours !== null ? Number(row.underHours) : null,
    billingAmount: Number(row.billingAmount),
  }
}

// ─── 精算計算（純粋関数） ─────────────────────────────────────────────────────

interface BillingCalcResult {
  billingHours: number
  overHours: number | null
  underHours: number | null
  billingAmount: number
}

function calcBillingAmount(
  billingType: string,
  actualHours: number,
  contract: MappedBillingContract,
): BillingCalcResult {
  const round2 = (v: number) => Math.round(v * 100) / 100

  switch (billingType) {
    case 'fixed':
      return {
        billingHours: actualHours,
        overHours: null,
        underHours: null,
        billingAmount: round2(contract.baseAmount ?? 0),
      }
    case 'hourly':
      return {
        billingHours: actualHours,
        overHours: null,
        underHours: null,
        billingAmount: round2(actualHours * (contract.overRate ?? 0)),
      }
    case 'range': {
      const min = contract.minHours ?? 0
      const max = contract.maxHours ?? Number.POSITIVE_INFINITY
      const base = contract.baseAmount ?? 0
      const overRate = contract.overRate ?? 0
      const underRate = contract.underRate ?? 0
      const overHours = Math.max(0, actualHours - max)
      const underHours = Math.max(0, min - actualHours)
      const billingAmount = round2(base + overHours * overRate - underHours * underRate)
      return {
        billingHours: actualHours,
        overHours: overHours > 0 ? round2(overHours) : null,
        underHours: underHours > 0 ? round2(underHours) : null,
        billingAmount,
      }
    }
    case 'project':
    default:
      return {
        billingHours: actualHours,
        overHours: null,
        underHours: null,
        billingAmount: round2(contract.baseAmount ?? 0),
      }
  }
}

// ─── 実績時間の計算 ───────────────────────────────────────────────────────────

async function fetchActualHours(
  tenantId: string,
  workTypeId: string,
  year: number,
  month: number,
): Promise<number> {
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  const rows = await db
    .select()
    .from(timeRecords)
    .where(
      and(
        eq(timeRecords.tenantId, tenantId),
        eq(timeRecords.workTypeId, workTypeId),
        gte(timeRecords.clockedAt, from),
        lte(timeRecords.clockedAt, to),
      ),
    )
    .orderBy(asc(timeRecords.clockedAt))

  let totalMs = 0
  let activeStart: Date | null = null

  for (const r of rows) {
    const ts = r.clockedAt
    switch (r.recordType as RecordType) {
      case 'clock_in':
        activeStart = ts
        break
      case 'break_start':
        if (activeStart) {
          totalMs += ts.getTime() - activeStart.getTime()
          activeStart = null
        }
        break
      case 'break_end':
        activeStart = ts
        break
      case 'clock_out':
        if (activeStart) {
          totalMs += ts.getTime() - activeStart.getTime()
          activeStart = null
        }
        break
    }
  }

  return Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100
}

// ─── 契約クエリ ───────────────────────────────────────────────────────────────

export async function listBillingContracts(tenantId: string): Promise<MappedBillingContract[]> {
  const rows = await db
    .select()
    .from(billingContracts)
    .where(eq(billingContracts.tenantId, tenantId))
    .orderBy(asc(billingContracts.contractStart))
  return rows.map(mapContract)
}

export async function findBillingContract(
  tenantId: string,
  id: string,
): Promise<MappedBillingContract | null> {
  const [row] = await db
    .select()
    .from(billingContracts)
    .where(and(eq(billingContracts.id, id), eq(billingContracts.tenantId, tenantId)))
  return row ? mapContract(row) : null
}

export type CreateBillingContractData = {
  tenantId: string
  workTypeId: string
  clientName: string
  billingType: string
  minHours?: number | null
  maxHours?: number | null
  baseAmount?: number | null
  overRate?: number | null
  underRate?: number | null
  contractStart: string
  contractEnd?: string | null
}

export async function createBillingContract(
  data: CreateBillingContractData,
): Promise<MappedBillingContract> {
  const [row] = await db
    .insert(billingContracts)
    .values({
      id: randomUUID(),
      tenantId: data.tenantId,
      workTypeId: data.workTypeId,
      clientName: data.clientName,
      billingType: data.billingType,
      minHours: data.minHours?.toString() ?? null,
      maxHours: data.maxHours?.toString() ?? null,
      baseAmount: data.baseAmount?.toString() ?? null,
      overRate: data.overRate?.toString() ?? null,
      underRate: data.underRate?.toString() ?? null,
      contractStart: data.contractStart,
      contractEnd: data.contractEnd ?? null,
      createdAt: new Date(),
    })
    .returning()
  return mapContract(row)
}

export type UpdateBillingContractData = Partial<
  Omit<CreateBillingContractData, 'tenantId'>
>

export async function updateBillingContract(
  tenantId: string,
  id: string,
  data: UpdateBillingContractData,
): Promise<MappedBillingContract | null> {
  const set: Record<string, unknown> = {}
  if (data.workTypeId !== undefined) set.workTypeId = data.workTypeId
  if (data.clientName !== undefined) set.clientName = data.clientName
  if (data.billingType !== undefined) set.billingType = data.billingType
  if (data.minHours !== undefined) set.minHours = data.minHours?.toString() ?? null
  if (data.maxHours !== undefined) set.maxHours = data.maxHours?.toString() ?? null
  if (data.baseAmount !== undefined) set.baseAmount = data.baseAmount?.toString() ?? null
  if (data.overRate !== undefined) set.overRate = data.overRate?.toString() ?? null
  if (data.underRate !== undefined) set.underRate = data.underRate?.toString() ?? null
  if (data.contractStart !== undefined) set.contractStart = data.contractStart
  if ('contractEnd' in data) set.contractEnd = data.contractEnd ?? null

  const [row] = await db
    .update(billingContracts)
    .set(set)
    .where(and(eq(billingContracts.id, id), eq(billingContracts.tenantId, tenantId)))
    .returning()
  return row ? mapContract(row) : null
}

export async function deleteBillingContract(
  tenantId: string,
  id: string,
): Promise<'ok' | 'not_found' | 'has_summaries'> {
  const contract = await findBillingContract(tenantId, id)
  if (!contract) return 'not_found'

  const [existing] = await db
    .select({ id: billingSummaries.id })
    .from(billingSummaries)
    .where(eq(billingSummaries.contractId, id))
    .limit(1)
  if (existing) return 'has_summaries'

  await db
    .delete(billingContracts)
    .where(and(eq(billingContracts.id, id), eq(billingContracts.tenantId, tenantId)))
  return 'ok'
}

// ─── サマリークエリ ───────────────────────────────────────────────────────────

export async function listBillingSummaries(
  tenantId: string,
  year: number,
  month: number,
): Promise<MappedBillingSummary[]> {
  const contractIds = (
    await db
      .select({ id: billingContracts.id })
      .from(billingContracts)
      .where(eq(billingContracts.tenantId, tenantId))
  ).map((r) => r.id)

  if (contractIds.length === 0) return []

  const rows = await db
    .select()
    .from(billingSummaries)
    .where(
      and(
        inArray(billingSummaries.contractId, contractIds),
        eq(billingSummaries.year, year),
        eq(billingSummaries.month, month),
      ),
    )
  return rows.map(mapSummary)
}

export async function calculateBillingSummary(
  tenantId: string,
  contractId: string,
  year: number,
  month: number,
): Promise<MappedBillingSummary | 'contract_not_found' | 'already_confirmed'> {
  const contract = await findBillingContract(tenantId, contractId)
  if (!contract) return 'contract_not_found'

  const [existing] = await db
    .select()
    .from(billingSummaries)
    .where(
      and(
        eq(billingSummaries.contractId, contractId),
        eq(billingSummaries.year, year),
        eq(billingSummaries.month, month),
      ),
    )
  if (existing?.status === 'confirmed') return 'already_confirmed'

  const actualHours = await fetchActualHours(tenantId, contract.workTypeId, year, month)
  const { billingHours, overHours, underHours, billingAmount } = calcBillingAmount(
    contract.billingType,
    actualHours,
    contract,
  )

  if (existing) {
    const [row] = await db
      .update(billingSummaries)
      .set({
        actualHours: actualHours.toString(),
        billingHours: billingHours.toString(),
        overHours: overHours?.toString() ?? null,
        underHours: underHours?.toString() ?? null,
        billingAmount: billingAmount.toString(),
        status: 'draft',
      })
      .where(eq(billingSummaries.id, existing.id))
      .returning()
    return mapSummary(row)
  }

  const [row] = await db
    .insert(billingSummaries)
    .values({
      id: randomUUID(),
      contractId,
      year,
      month,
      actualHours: actualHours.toString(),
      billingHours: billingHours.toString(),
      overHours: overHours?.toString() ?? null,
      underHours: underHours?.toString() ?? null,
      billingAmount: billingAmount.toString(),
      status: 'draft',
      confirmedAt: null,
      createdAt: new Date(),
    })
    .returning()
  return mapSummary(row)
}

export async function confirmBillingSummary(
  id: string,
): Promise<MappedBillingSummary | 'not_found' | 'already_confirmed'> {
  const [existing] = await db
    .select()
    .from(billingSummaries)
    .where(eq(billingSummaries.id, id))
  if (!existing) return 'not_found'
  if (existing.status === 'confirmed') return 'already_confirmed'

  const [row] = await db
    .update(billingSummaries)
    .set({ status: 'confirmed', confirmedAt: new Date() })
    .where(eq(billingSummaries.id, id))
    .returning()
  return mapSummary(row)
}
