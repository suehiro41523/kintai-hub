ALTER TABLE "core"."tenants" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "core"."tenants" ADD COLUMN "stripe_subscription_id" varchar(255);--> statement-breakpoint
ALTER TABLE "core"."tenants" ADD COLUMN "stripe_price_id" varchar(255);--> statement-breakpoint
ALTER TABLE "core"."tenants" ADD COLUMN "subscription_status" varchar(50);--> statement-breakpoint
ALTER TABLE "core"."tenants" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."tenants" ADD COLUMN "billed_seats" integer;--> statement-breakpoint
CREATE INDEX "idx_tenants_stripe_customer_id" ON "core"."tenants" USING btree ("stripe_customer_id");