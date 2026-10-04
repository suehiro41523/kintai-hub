ALTER TABLE "auth"."account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."verification" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "auth"."account" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."session" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."user" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."verification" CASCADE;--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "auth_user_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_auth_user_id" ON "core"."users" USING btree ("auth_user_id");--> statement-breakpoint
ALTER TABLE "core"."users" ADD CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id");--> statement-breakpoint
DROP SCHEMA "auth";
