export type Role = 'admin' | 'manager' | 'employee'

// Cloudflare Hyperdriveバインディング。ローカル(Node)実行時は存在しないためoptional
export type Bindings = {
  HYPERDRIVE?: { connectionString: string }
}

export type AppEnv = {
  Variables: {
    userId: string
    tenantId: string
    role: Role
  }
  Bindings: Bindings
}

export type RecordType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
export type BillingType = 'fixed' | 'hourly' | 'range' | 'project'

export type ActiveSession = {
  workTypeId: string
  clockedInAt: string
  isOnBreak: boolean
  breakStartedAt: string | null
}

export type DaySummary = {
  totalMin: number
  breakMin: number
  workTypeBreakdown: { workTypeId: string; workTypeName: string; minutes: number }[]
}
