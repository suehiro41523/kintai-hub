import {
  boolean,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { tenants, users } from './core.js'

export const appSchema = pgSchema('app')

// ─── app.work_types ★差別化機能 ───────────────────────────────────────────────

export const workTypes = appSchema.table(
  'work_types',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 100 }).notNull(),
    color: varchar('color', { length: 7 }).notNull(),
    billingType: varchar('billing_type', { length: 50 }).notNull(),
    isBillable: boolean('is_billable').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_work_types_tenant_id').on(t.tenantId),
    index('idx_work_types_active').on(t.tenantId, t.isActive),
  ],
)

// ─── app.time_records ★差別化機能 ────────────────────────────────────────────

export const timeRecords = appSchema.table(
  'time_records',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    workTypeId: uuid('work_type_id')
      .notNull()
      .references(() => workTypes.id),
    recordType: varchar('record_type', { length: 50 }).notNull(),
    clockedAt: timestamp('clocked_at', { withTimezone: true }).notNull(),
    locationLat: decimal('location_lat', { precision: 9, scale: 6 }),
    locationLng: decimal('location_lng', { precision: 9, scale: 6 }),
    deviceType: varchar('device_type', { length: 50 }),
    isModified: boolean('is_modified').notNull().default(false),
    modifiedBy: uuid('modified_by').references(() => users.id),
    modifiedAt: timestamp('modified_at', { withTimezone: true }),
    originalClockedAt: timestamp('original_clocked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_tr_user_clocked').on(t.userId, t.clockedAt),
    index('idx_tr_worktype_clocked').on(t.workTypeId, t.clockedAt),
    index('idx_tr_tenant_user_clocked').on(t.tenantId, t.userId, t.clockedAt),
  ],
)

// ─── app.shift_patterns ───────────────────────────────────────────────────────

export const shiftPatterns = appSchema.table('shift_patterns', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: varchar('name', { length: 100 }).notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  breakMinutes: integer('break_minutes').notNull(),
  isActive: boolean('is_active').notNull().default(true),
})

// ─── app.shifts ───────────────────────────────────────────────────────────────

export const shifts = appSchema.table(
  'shifts',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    workTypeId: uuid('work_type_id').references(() => workTypes.id),
    shiftPatternId: uuid('shift_pattern_id').references(() => shiftPatterns.id),
    shiftDate: date('shift_date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_shifts_user_date').on(t.userId, t.shiftDate),
    index('idx_shifts_tenant_date').on(t.shiftDate, t.tenantId),
  ],
)

// ─── app.requests ─────────────────────────────────────────────────────────────

export const requests = appSchema.table(
  'requests',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    requestType: varchar('request_type', { length: 50 }).notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    startTime: time('start_time'),
    endTime: time('end_time'),
    targetRecordId: uuid('target_record_id').references(() => timeRecords.id),
    reason: text('reason'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_req_user_status').on(t.userId, t.status),
    index('idx_req_tenant_status').on(t.tenantId, t.status, t.createdAt),
  ],
)

// ─── app.request_approvals ────────────────────────────────────────────────────

export const requestApprovals = appSchema.table('request_approvals', {
  id: uuid('id').primaryKey(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => requests.id),
  approverId: uuid('approver_id')
    .notNull()
    .references(() => users.id),
  step: integer('step').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  comment: text('comment'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
})

// ─── app.billing_contracts ★差別化機能 ───────────────────────────────────────

export const billingContracts = appSchema.table('billing_contracts', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  workTypeId: uuid('work_type_id')
    .notNull()
    .references(() => workTypes.id),
  clientName: varchar('client_name', { length: 255 }).notNull(),
  billingType: varchar('billing_type', { length: 50 }).notNull(),
  minHours: decimal('min_hours', { precision: 6, scale: 2 }),
  maxHours: decimal('max_hours', { precision: 6, scale: 2 }),
  baseAmount: decimal('base_amount', { precision: 12, scale: 2 }),
  overRate: decimal('over_rate', { precision: 10, scale: 2 }),
  underRate: decimal('under_rate', { precision: 10, scale: 2 }),
  contractStart: date('contract_start').notNull(),
  contractEnd: date('contract_end'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── app.billing_contract_members ─────────────────────────────────────────────

export const billingContractMembers = appSchema.table('billing_contract_members', {
  id: uuid('id').primaryKey(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => billingContracts.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  assignedFrom: date('assigned_from').notNull(),
  assignedTo: date('assigned_to'),
})

// ─── app.billing_summaries ★差別化機能 ───────────────────────────────────────

export const billingSummaries = appSchema.table(
  'billing_summaries',
  {
    id: uuid('id').primaryKey(),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => billingContracts.id),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    actualHours: decimal('actual_hours', { precision: 8, scale: 2 }).notNull(),
    billingHours: decimal('billing_hours', { precision: 8, scale: 2 }).notNull(),
    overHours: decimal('over_hours', { precision: 8, scale: 2 }),
    underHours: decimal('under_hours', { precision: 8, scale: 2 }),
    billingAmount: decimal('billing_amount', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_bs_contract_ym').on(t.contractId, t.year, t.month)],
)

// ─── app.notifications ────────────────────────────────────────────────────────

export const notifications = appSchema.table(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: varchar('type', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body'),
    linkUrl: varchar('link_url', { length: 500 }),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_notif_user_read').on(t.userId, t.isRead)],
)

// ─── app.audit_logs（INSERT専用・UPDATE/DELETE禁止） ──────────────────────────

export const auditLogs = appSchema.table(
  'audit_logs',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 100 }).notNull(),
    resourceId: uuid('resource_id'),
    beforeValue: jsonb('before_value'),
    afterValue: jsonb('after_value'),
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 最大45文字
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_al_tenant_created').on(t.tenantId, t.createdAt),
    index('idx_al_resource').on(t.resourceType, t.resourceId),
  ],
)
