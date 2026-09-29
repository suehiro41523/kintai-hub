import {
  boolean,
  decimal,
  index,
  integer,
  pgSchema,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const coreSchema = pgSchema('core')

// ─── core.tenants ─────────────────────────────────────────────────────────────

export const tenants = coreSchema.table(
  'tenants',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    plan: varchar('plan', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    maxUsers: integer('max_users'),
    // Stripeサブスクリプション連携（2026-09-22追加）。
    // サインアップ時点では全カラムnull（plan='free'はStripe未経由）。
    // ダッシュボードの「プラン変更」でCheckoutを通過した時点でstripeCustomerIdが確定する。
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    stripePriceId: varchar('stripe_price_id', { length: 255 }),
    // Stripeのsubscription.statusをそのまま保持する（trialing/active/past_due/canceled/unpaid等）
    subscriptionStatus: varchar('subscription_status', { length: 50 }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    // 人数課金プラン（standard/pro）の契約人数。Stripe側のsubscription item quantityと管理画面から手動で同期する
    billedSeats: integer('billed_seats'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_tenants_status').on(t.status),
    index('idx_tenants_plan').on(t.plan),
    index('idx_tenants_stripe_customer_id').on(t.stripeCustomerId),
  ],
)

// ─── core.departments ─────────────────────────────────────────────────────────

export const departments = coreSchema.table(
  'departments',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    parentId: uuid('parent_id'), // 自己参照。循環参照のためreferencesは省略
    name: varchar('name', { length: 100 }).notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_departments_tenant_id').on(t.tenantId),
    index('idx_departments_parent_id').on(t.parentId),
  ],
)

// ─── core.users ───────────────────────────────────────────────────────────────

export const users = coreSchema.table(
  'users',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    departmentId: uuid('department_id').references(() => departments.id),
    // Supabase Auth側(auth.users)のユーザーIDへの参照。認証情報はSupabase側が持つため、
    // ここはリンクのみ(外部スキーマのため drizzle の references() は使わない)
    authUserId: uuid('auth_user_id').notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    role: varchar('role', { length: 50 }).notNull(),
    employmentType: varchar('employment_type', { length: 50 }).notNull(),
    hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
    monthlySalary: decimal('monthly_salary', { precision: 12, scale: 2 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_users_tenant_id').on(t.tenantId),
    index('idx_users_email').on(t.email),
    index('idx_users_tenant_role').on(t.tenantId, t.role),
    index('idx_users_auth_user_id').on(t.authUserId),
  ],
)
