import { useQuery } from '@tanstack/react-query'
import type { TimeRecord, WorkType } from '@/lib/api-client'
import { api } from '@/lib/api-client'

function toDateParam(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = toDateParam(new Date(Date.UTC(year, month - 1, 1)))
  const to = toDateParam(new Date(Date.UTC(year, month, 0)))
  return { from, to }
}

export interface DayEntry {
  dateKey: string // "2026-05-01"
  records: TimeRecord[]
  clockInAt: string | null
  clockOutAt: string | null
  totalMin: number
  breakMin: number
  workTypeBreakdown: { workTypeId: string; workTypeName: string; minutes: number }[]
}

export interface MonthSummary {
  totalMin: number
  breakMin: number
  workTypeBreakdown: { workTypeId: string; workTypeName: string; minutes: number }[]
}

function computeDayEntry(dateKey: string, records: TimeRecord[], workTypes: WorkType[]): DayEntry {
  const wtMap = new Map(workTypes.map((w) => [w.id, w.name]))

  const clockInAt = records.find((r) => r.recordType === 'clock_in')?.clockedAt ?? null
  const clockOutAt =
    [...records].reverse().find((r) => r.recordType === 'clock_out')?.clockedAt ?? null

  const grouped = new Map<string, TimeRecord[]>()
  for (const r of records) {
    if (!grouped.has(r.workTypeId)) grouped.set(r.workTypeId, [])
    grouped.get(r.workTypeId)?.push(r)
  }

  const netMsByType = new Map<string, number>()
  let totalBreakMs = 0

  for (const [wtId, recs] of grouped) {
    let activeStart: Date | null = null
    let netMs = 0

    for (const r of recs) {
      const ts = new Date(r.clockedAt)
      switch (r.recordType) {
        case 'clock_in':
          activeStart = ts
          break
        case 'break_start':
          if (activeStart) {
            netMs += ts.getTime() - activeStart.getTime()
            activeStart = null
          }
          break
        case 'break_end': {
          const prevBreak = [...recs]
            .filter((b) => b.recordType === 'break_start' && b.clockedAt < r.clockedAt)
            .at(-1)
          if (prevBreak) totalBreakMs += ts.getTime() - new Date(prevBreak.clockedAt).getTime()
          activeStart = ts
          break
        }
        case 'clock_out':
          if (activeStart) {
            netMs += ts.getTime() - activeStart.getTime()
            activeStart = null
          }
          break
      }
    }
    netMsByType.set(wtId, (netMsByType.get(wtId) ?? 0) + netMs)
  }

  const workTypeBreakdown = Array.from(netMsByType.entries())
    .filter(([, ms]) => ms > 0)
    .map(([workTypeId, ms]) => ({
      workTypeId,
      workTypeName: wtMap.get(workTypeId) ?? workTypeId,
      minutes: Math.floor(ms / 60000),
    }))

  const totalMin = workTypeBreakdown.reduce((s, b) => s + b.minutes, 0)
  const breakMin = Math.floor(totalBreakMs / 60000)

  return { dateKey, records, clockInAt, clockOutAt, totalMin, breakMin, workTypeBreakdown }
}

function buildDays(records: TimeRecord[], workTypes: WorkType[]): DayEntry[] {
  const grouped = new Map<string, TimeRecord[]>()
  for (const r of records) {
    const key = r.clockedAt.slice(0, 10)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)?.push(r)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, recs]) => computeDayEntry(dateKey, recs, workTypes))
}

function buildMonthSummary(days: DayEntry[], workTypes: WorkType[]): MonthSummary {
  const wtMap = new Map(workTypes.map((w) => [w.id, w.name]))
  const minutesByType = new Map<string, number>()
  let totalMin = 0
  let breakMin = 0

  for (const day of days) {
    totalMin += day.totalMin
    breakMin += day.breakMin
    for (const b of day.workTypeBreakdown) {
      minutesByType.set(b.workTypeId, (minutesByType.get(b.workTypeId) ?? 0) + b.minutes)
    }
  }

  const workTypeBreakdown = Array.from(minutesByType.entries())
    .filter(([, m]) => m > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([workTypeId, minutes]) => ({
      workTypeId,
      workTypeName: wtMap.get(workTypeId) ?? workTypeId,
      minutes,
    }))

  return { totalMin, breakMin, workTypeBreakdown }
}

export function useHistory(year: number, month: number, workTypes: WorkType[]) {
  const { from, to } = monthRange(year, month)

  const query = useQuery({
    queryKey: ['time-records', 'history', from, to],
    queryFn: () => api.timeRecords.list(from, to),
    staleTime: 60_000,
  })

  const records = query.data?.records ?? []
  const days = buildDays(records, workTypes)
  const monthlySummary = buildMonthSummary(days, workTypes)

  return { ...query, days, monthlySummary }
}
