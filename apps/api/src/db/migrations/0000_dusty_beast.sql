CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "app"."audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" uuid,
	"before_value" jsonb,
	"after_value" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."billing_contract_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contract_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_from" date NOT NULL,
	"assigned_to" date
);
--> statement-breakpoint
CREATE TABLE "app"."billing_contracts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_type_id" uuid NOT NULL,
	"client_name" varchar(255) NOT NULL,
	"billing_type" varchar(50) NOT NULL,
	"min_hours" numeric(6, 2),
	"max_hours" numeric(6, 2),
	"base_amount" numeric(12, 2),
	"over_rate" numeric(10, 2),
	"under_rate" numeric(10, 2),
	"contract_start" date NOT NULL,
	"contract_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."billing_summaries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contract_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"actual_hours" numeric(8, 2) NOT NULL,
	"billing_hours" numeric(8, 2) NOT NULL,
	"over_hours" numeric(8, 2),
	"under_hours" numeric(8, 2),
	"billing_amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"link_url" varchar(500),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."request_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"comment" text,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"request_type" varchar(50) NOT NULL,
	"start_date" date,
	"end_date" date,
	"start_time" time,
	"end_time" time,
	"target_record_id" uuid,
	"reason" text,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."shift_patterns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"break_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."shifts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_type_id" uuid,
	"shift_pattern_id" uuid,
	"shift_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."time_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_type_id" uuid NOT NULL,
	"record_type" varchar(50) NOT NULL,
	"clocked_at" timestamp with time zone NOT NULL,
	"location_lat" numeric(9, 6),
	"location_lng" numeric(9, 6),
	"device_type" varchar(50),
	"is_modified" boolean DEFAULT false NOT NULL,
	"modified_by" uuid,
	"modified_at" timestamp with time zone,
	"original_clocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."work_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"billing_type" varchar(50) NOT NULL,
	"is_billable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."departments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."tenants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"max_users" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"department_id" uuid,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"employment_type" varchar(50) NOT NULL,
	"hourly_rate" numeric(10, 2),
	"monthly_salary" numeric(12, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."billing_contract_members" ADD CONSTRAINT "billing_contract_members_contract_id_billing_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "app"."billing_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."billing_contract_members" ADD CONSTRAINT "billing_contract_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."billing_contracts" ADD CONSTRAINT "billing_contracts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."billing_contracts" ADD CONSTRAINT "billing_contracts_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "app"."work_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."billing_summaries" ADD CONSTRAINT "billing_summaries_contract_id_billing_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "app"."billing_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."request_approvals" ADD CONSTRAINT "request_approvals_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."request_approvals" ADD CONSTRAINT "request_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."requests" ADD CONSTRAINT "requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."requests" ADD CONSTRAINT "requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."requests" ADD CONSTRAINT "requests_target_record_id_time_records_id_fk" FOREIGN KEY ("target_record_id") REFERENCES "app"."time_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shift_patterns" ADD CONSTRAINT "shift_patterns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shifts" ADD CONSTRAINT "shifts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shifts" ADD CONSTRAINT "shifts_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "app"."work_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shifts" ADD CONSTRAINT "shifts_shift_pattern_id_shift_patterns_id_fk" FOREIGN KEY ("shift_pattern_id") REFERENCES "app"."shift_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shifts" ADD CONSTRAINT "shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."time_records" ADD CONSTRAINT "time_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."time_records" ADD CONSTRAINT "time_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."time_records" ADD CONSTRAINT "time_records_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "app"."work_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."time_records" ADD CONSTRAINT "time_records_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."work_types" ADD CONSTRAINT "work_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."departments" ADD CONSTRAINT "departments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "core"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_al_tenant_created" ON "app"."audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_al_resource" ON "app"."audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_bs_contract_ym" ON "app"."billing_summaries" USING btree ("contract_id","year","month");--> statement-breakpoint
CREATE INDEX "idx_notif_user_read" ON "app"."notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_req_user_status" ON "app"."requests" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_req_tenant_status" ON "app"."requests" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_shifts_user_date" ON "app"."shifts" USING btree ("user_id","shift_date");--> statement-breakpoint
CREATE INDEX "idx_shifts_tenant_date" ON "app"."shifts" USING btree ("shift_date","tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tr_user_clocked" ON "app"."time_records" USING btree ("user_id","clocked_at");--> statement-breakpoint
CREATE INDEX "idx_tr_worktype_clocked" ON "app"."time_records" USING btree ("work_type_id","clocked_at");--> statement-breakpoint
CREATE INDEX "idx_tr_tenant_user_clocked" ON "app"."time_records" USING btree ("tenant_id","user_id","clocked_at");--> statement-breakpoint
CREATE INDEX "idx_work_types_tenant_id" ON "app"."work_types" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_work_types_active" ON "app"."work_types" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_departments_tenant_id" ON "core"."departments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_departments_parent_id" ON "core"."departments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_tenants_status" ON "core"."tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tenants_plan" ON "core"."tenants" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "idx_users_tenant_id" ON "core"."users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "core"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_tenant_role" ON "core"."users" USING btree ("tenant_id","role");