import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { RecordType } from '../../types.js'
import { db } from '../index.js'
import { billingContracts, billingSummaries, timeRecords, workTypes } from '../schema/app.js'

// ─── 型定義 ───────────────────────────────────────────────────────────────────

export interface WorkTypeHours {
  workTypeId: string
  workTypeName: string
  color: string
  isBillable: boolean
  hours: number
  percentage: number
}

export interface BillingBreakdown {
  contractId: string
  clientName: string
  billingType: string
  workTypeId: string
  workTypeName: string
  actualHours: number
  billingHours: number | null
  billingAmount: number | null
  status: 'uncalculated' | 'draft' | 'confirmed'
}

export interface MonthlyReport {
  year: number
  month: number
  totalHours: number
  billableHours: number
  nonBillableHours: number
  workTypeBreakdown: WorkTypeHours[]
  billingBreakdown: BillingBreakdown[]
}

// ─── 稼働時間の集計（全ワークタイプ一括） ──────────────────────────────────────

function calcHoursPerWorkType(
  rows: { workTypeId: string; clockedAt: Date; recordType: string }[],
): Map<string, number> {
  const hoursMap = new Map<string, number>()
  const activeStart = new Map<string, Date>()
  const totalMs = new Map<string, number>()

  for (const r of rows) {
    const wid = r.workTypeId
    const ts = r.clockedAt

    switch (r.recordType as RecordType) {
      case 'clock_in':
        activeStart.set(wid, ts)
        break
      case 'break_start': {
        const start = activeStart.get(wid)
        if (start) {
          totalMs.set(wid, (totalMs.get(wid) ?? 0) + ts.getTime() - start.getTime())
          activeStart.delete(wid)
        }
        break
      }
      case 'break_end':
        activeStart.set(wid, ts)
        break
      case 'clock_out': {
        const start = activeStart.get(wid)
        if (start) {
          totalMs.set(wid, (totalMs.get(wid) ?? 0) + ts.getTime() - start.getTime())
          activeStart.delete(wid)
        }
        break
      }
    }
  }

  for (const [wid, ms] of totalMs) {
    hoursMap.set(wid, Math.round((ms / (1000 * 60 * 60)) * 100) / 100)
  }
  return hoursMap
}

// ─── 月次レポート ──────────────────────────────────────────────────────────────

export async function getMonthlyReport(
  tenantId: string,
  year: number,
  month: number,
): Promise<MonthlyReport> {
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  // ワークタイプ・打刻レコード・契約・サマリーを並列取得
  const [wts, records, contracts] = await Promise.all([
    db
      .select()
      .from(workTypes)
      .where(and(eq(workTypes.tenantId, tenantId), eq(workTypes.isActive, true))),
    db
      .select({
        workTypeId: timeRecords.workTypeId,
        clockedAt: timeRecords.clockedAt,
        recordType: timeRecords.recordType,
      })
      .from(timeRecords)
      .where(
        and(
          eq(timeRecords.tenantId, tenantId),
          gte(timeRecords.clockedAt, from),
          lte(timeRecords.clockedAt, to),
        ),
      )
      .orderBy(asc(timeRecords.workTypeId), asc(timeRecords.clockedAt)),
    db.select().from(billingContracts).where(eq(billingContracts.tenantId, tenantId)),
  ])

  // 契約に紐づくサマリーを取得
  const contractIds = contracts.map((c) => c.id)
  const summaries =
    contractIds.length > 0
      ? await db
          .select()
          .from(billingSummaries)
          .where(
            and(
              inArray(billingSummaries.contractId, contractIds),
              eq(billingSummaries.year, year),
              eq(billingSummaries.month, month),
            ),
          )
      : []

  const summaryMap = new Map(summaries.map((s) => [s.contractId, s]))
  const wtMap = new Map(wts.map((w) => [w.id, w]))

  // ワークタイプ別稼働時間を計算
  const hoursMap = calcHoursPerWorkType(records)

  // 集計
  let totalHours = 0
  let billableHours = 0

  const workTypeBreakdown: WorkTypeHours[] = []
  for (const [wid, hours] of hoursMap) {
    const wt = wtMap.get(wid)
    if (!wt || hours === 0) continue
    totalHours += hours
    if (wt.isBillable) billableHours += hours
    workTypeBreakdown.push({
      workTypeId: wid,
      workTypeName: wt.name,
      color: wt.color,
      isBillable: wt.isBillable,
      hours,
      percentage: 0, // 後で計算
    })
  }

  // percentageを計算
  for (const item of workTypeBreakdown) {
    item.percentage = totalHours > 0 ? Math.round((item.hours / totalHours) * 1000) / 10 : 0
  }

  // 稼働時間順にソート
  workTypeBreakdown.sort((a, b) => b.hours - a.hours)

  // 契約別精算内訳
  const billingBreakdown: BillingBreakdown[] = contracts.map((c) => {
    const summary = summaryMap.get(c.id)
    const wt = wtMap.get(c.workTypeId)
    return {
      contractId: c.id,
      clientName: c.clientName,
      billingType: c.billingType,
      workTypeId: c.workTypeId,
      workTypeName: wt?.name ?? c.workTypeId,
      actualHours: summary ? Number(summary.actualHours) : (hoursMap.get(c.workTypeId) ?? 0),
      billingHours: summary ? Number(summary.billingHours) : null,
      billingAmount: summary ? Number(summary.billingAmount) : null,
      status: summary ? (summary.status as 'draft' | 'confirmed') : 'uncalculated',
    }
  })

  return {
    year,
    month,
    totalHours: Math.round(totalHours * 100) / 100,
    billableHours: Math.round(billableHours * 100) / 100,
    nonBillableHours: Math.round((totalHours - billableHours) * 100) / 100,
    workTypeBreakdown,
    billingBreakdown,
  }
}
