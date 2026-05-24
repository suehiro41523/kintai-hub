// ─── 型定義 ────────────────────────────────────────────────────────────────────
// TODO: packages/types に移動する

export type RecordType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
export type BillingType = 'fixed' | 'hourly' | 'range' | 'project'

export interface WorkType {
  id: string
  tenantId: string
  name: string
  color: string
  billingType: BillingType
  isBillable: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export interface TimeRecord {
  id: string
  userId: string
  tenantId: string
  workTypeId: string
  recordType: RecordType
  clockedAt: string
  deviceType: string
  locationLat: number | null
  locationLng: number | null
  isModified: boolean
  createdAt: string
}

export interface ActiveSession {
  workTypeId: string
  clockedInAt: string
  isOnBreak: boolean
  breakStartedAt: string | null
}

export interface DaySummary {
  totalMin: number
  breakMin: number
  workTypeBreakdown: { workTypeId: string; workTypeName: string; minutes: number }[]
}

export interface TodayResponse {
  records: TimeRecord[]
  summary: DaySummary
  activeSession: ActiveSession | null
}

export interface HistoryResponse {
  records: TimeRecord[]
  total: number
}

// ─── エラークラス ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── fetch ラッパー ────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
    throw new ApiError(res.status, body.error ?? 'エラーが発生しました', body.code)
  }

  return res.json() as Promise<T>
}

// ─── API クライアント ──────────────────────────────────────────────────────────

export const api = {
  workTypes: {
    list: () => request<{ workTypes: WorkType[] }>('/work-types'),
  },

  timeRecords: {
    today: () => request<TodayResponse>('/time-records/today'),

    clockIn: (workTypeId: string) =>
      request<{ record: TimeRecord }>('/time-records/clock-in', {
        method: 'POST',
        body: JSON.stringify({ workTypeId }),
      }),

    clockOut: (workTypeId: string) =>
      request<{ record: TimeRecord; dailySummary: DaySummary }>('/time-records/clock-out', {
        method: 'POST',
        body: JSON.stringify({ workTypeId }),
      }),

    breakStart: (workTypeId: string) =>
      request<{ record: TimeRecord }>('/time-records/break-start', {
        method: 'POST',
        body: JSON.stringify({ workTypeId }),
      }),

    breakEnd: (workTypeId: string) =>
      request<{ record: TimeRecord }>('/time-records/break-end', {
        method: 'POST',
        body: JSON.stringify({ workTypeId }),
      }),

    switchType: (fromWorkTypeId: string, toWorkTypeId: string) =>
      request<{ clockOutRecord: TimeRecord; clockInRecord: TimeRecord }>(
        '/time-records/switch-type',
        {
          method: 'POST',
          body: JSON.stringify({ fromWorkTypeId, toWorkTypeId }),
        },
      ),

    list: (from: string, to: string) =>
      request<HistoryResponse>(`/time-records?from=${from}&to=${to}`),
  },
}
