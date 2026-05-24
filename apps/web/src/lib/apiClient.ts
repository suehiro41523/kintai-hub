// ─── 型定義 ────────────────────────────────────────────────────────────────────
// TODO: packages/types に移動する

export type RecordType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
export type RequestType = 'leave' | 'overtime' | 'correction'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type BillingType = 'fixed' | 'hourly' | 'range' | 'project'
export type UserRole = 'admin' | 'manager' | 'employee'
export type EmploymentType = 'full_time' | 'part_time' | 'contract'

export interface User {
  id: string
  tenantId: string
  departmentId: string | null
  name: string
  email: string
  role: UserRole
  employmentType: EmploymentType
  hourlyRate: number | null
  monthlySalary: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

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

export interface BillingContract {
  id: string
  tenantId: string
  workTypeId: string
  clientName: string
  billingType: BillingType
  minHours: number | null
  maxHours: number | null
  baseAmount: number | null
  overRate: number | null
  underRate: number | null
  contractStart: string
  contractEnd: string | null
  createdAt: string
}

export type BillingSummaryStatus = 'draft' | 'confirmed'

export interface BillingSummary {
  id: string
  contractId: string
  year: number
  month: number
  actualHours: number
  billingHours: number
  overHours: number | null
  underHours: number | null
  billingAmount: number
  status: BillingSummaryStatus
  confirmedAt: string | null
  createdAt: string
}

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

export interface AuthUser {
  id: string
  tenantId: string
  name: string
  email: string
  role: string
}

export interface ShiftPattern {
  id: string
  tenantId: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
  isActive: boolean
}

export interface Shift {
  id: string
  userId: string
  tenantId: string
  workTypeId: string | null
  shiftPatternId: string | null
  shiftDate: string
  startTime: string
  endTime: string
  status: string
  createdBy: string
  createdAt: string
}

export interface Request {
  id: string
  userId: string
  tenantId: string
  requestType: RequestType
  startDate: string | null
  endDate: string | null
  startTime: string | null
  endTime: string | null
  targetRecordId: string | null
  reason: string | null
  status: RequestStatus
  createdAt: string
  updatedAt: string
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

const BASE_URL = ''

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
  auth: {
    signIn: (email: string, password: string) =>
      request<{ user: AuthUser }>('/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    signOut: () => request<{ success: boolean }>('/auth/sign-out', { method: 'POST' }),

    me: () => request<{ user: AuthUser }>('/auth/me'),
  },

  workTypes: {
    list: () => request<{ workTypes: WorkType[] }>('/work-types'),

    create: (data: {
      name: string
      color: string
      billingType: BillingType
      isBillable: boolean
      sortOrder: number
    }) =>
      request<{ workType: WorkType }>('/work-types', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (
      id: string,
      data: Partial<{
        name: string
        color: string
        billingType: BillingType
        isBillable: boolean
        sortOrder: number
      }>,
    ) =>
      request<{ workType: WorkType }>(`/work-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deactivate: (id: string) =>
      request<{ success: boolean }>(`/work-types/${id}`, { method: 'DELETE' }),

    reorder: (orders: { id: string; sortOrder: number }[]) =>
      request<{ success: boolean }>('/work-types/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ orders }),
      }),
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

  billing: {
    listContracts: () => request<{ contracts: BillingContract[] }>('/billing/contracts'),

    createContract: (data: {
      workTypeId: string
      clientName: string
      billingType: BillingType
      minHours?: number | null
      maxHours?: number | null
      baseAmount?: number | null
      overRate?: number | null
      underRate?: number | null
      contractStart: string
      contractEnd?: string | null
    }) =>
      request<{ contract: BillingContract }>('/billing/contracts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateContract: (
      id: string,
      data: Partial<{
        workTypeId: string
        clientName: string
        billingType: BillingType
        minHours: number | null
        maxHours: number | null
        baseAmount: number | null
        overRate: number | null
        underRate: number | null
        contractStart: string
        contractEnd: string | null
      }>,
    ) =>
      request<{ contract: BillingContract }>(`/billing/contracts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteContract: (id: string) =>
      request<{ success: boolean }>(`/billing/contracts/${id}`, { method: 'DELETE' }),

    listSummaries: (year: number, month: number) =>
      request<{ summaries: BillingSummary[] }>(`/billing/summaries?year=${year}&month=${month}`),

    calculate: (contractId: string, year: number, month: number) =>
      request<{ summary: BillingSummary }>('/billing/summaries/calculate', {
        method: 'POST',
        body: JSON.stringify({ contractId, year, month }),
      }),

    confirm: (summaryId: string) =>
      request<{ summary: BillingSummary }>(`/billing/summaries/${summaryId}/confirm`, {
        method: 'POST',
      }),
  },

  reports: {
    monthly: (year: number, month: number) =>
      request<{ report: MonthlyReport }>(`/reports/monthly?year=${year}&month=${month}`),
  },

  users: {
    list: () => request<{ users: User[] }>('/users'),

    create: (data: {
      name: string
      email: string
      role: UserRole
      employmentType: EmploymentType
      hourlyRate?: number | null
      monthlySalary?: number | null
    }) =>
      request<{ user: User }>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (
      id: string,
      data: Partial<{
        name: string
        email: string
        role: UserRole
        employmentType: EmploymentType
        hourlyRate: number | null
        monthlySalary: number | null
      }>,
    ) =>
      request<{ user: User }>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deactivate: (id: string) => request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' }),
  },

  requests: {
    listMy: () => request<{ requests: Request[] }>('/requests/my'),

    listPending: () => request<{ requests: Request[] }>('/requests/pending'),

    create: (data: {
      requestType: RequestType
      startDate?: string | null
      endDate?: string | null
      startTime?: string | null
      endTime?: string | null
      reason?: string | null
    }) =>
      request<{ request: Request }>('/requests', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    approve: (id: string, comment?: string | null) =>
      request<{ request: Request }>(`/requests/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment ?? null }),
      }),

    reject: (id: string, comment?: string | null) =>
      request<{ request: Request }>(`/requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment ?? null }),
      }),

    cancel: (id: string) => request<{ success: boolean }>(`/requests/${id}`, { method: 'DELETE' }),
  },

  shiftPatterns: {
    list: () => request<{ patterns: ShiftPattern[] }>('/shift-patterns'),

    create: (data: { name: string; startTime: string; endTime: string; breakMinutes: number }) =>
      request<{ pattern: ShiftPattern }>('/shift-patterns', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (
      id: string,
      data: Partial<{
        name: string
        startTime: string
        endTime: string
        breakMinutes: number
        isActive: boolean
      }>,
    ) =>
      request<{ pattern: ShiftPattern }>(`/shift-patterns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  shifts: {
    listMy: (from: string, to: string) =>
      request<{ shifts: Shift[] }>(`/shifts?from=${from}&to=${to}`),

    listTeam: (from: string, to: string, userId?: string) =>
      request<{ shifts: Shift[] }>(
        `/shifts/team?from=${from}&to=${to}${userId ? `&userId=${userId}` : ''}`,
      ),

    bulkUpsert: (
      items: {
        userId: string
        shiftDate: string
        startTime: string
        endTime: string
        workTypeId?: string | null
        shiftPatternId?: string | null
      }[],
    ) =>
      request<{ created: Shift[]; updated: Shift[]; errors: { index: number; message: string }[] }>(
        '/shifts/bulk',
        { method: 'POST', body: JSON.stringify({ shifts: items }) },
      ),

    delete: (id: string) => request<{ success: boolean }>(`/shifts/${id}`, { method: 'DELETE' }),
  },
}
