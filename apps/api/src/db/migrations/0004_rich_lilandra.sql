-- ─── tenant_id列の追加 ──────────────────────────────────────────────────────────
-- 既存行があるとNOT NULLで追加できないため、NULL可で追加 → 親テーブルから値を埋める → NOT NULL化の順に行う
ALTER TABLE "app"."billing_contract_members" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."billing_summaries" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."request_approvals" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "app"."billing_contract_members" m SET "tenant_id" = c."tenant_id" FROM "app"."billing_contracts" c WHERE m."contract_id" = c."id";--> statement-breakpoint
UPDATE "app"."billing_summaries" s SET "tenant_id" = c."tenant_id" FROM "app"."billing_contracts" c WHERE s."contract_id" = c."id";--> statement-breakpoint
UPDATE "app"."request_approvals" a SET "tenant_id" = r."tenant_id" FROM "app"."requests" r WHERE a."request_id" = r."id";--> statement-breakpoint
ALTER TABLE "app"."billing_contract_members" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."billing_summaries" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."request_approvals" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."billing_contract_members" ADD CONSTRAINT "billing_contract_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."billing_summaries" ADD CONSTRAINT "billing_summaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."request_approvals" ADD CONSTRAINT "request_approvals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ─── RLS適用対象のロール ──────────────────────────────────────────────────────
-- スーパーユーザー・テーブル所有者はRLSを無視するため、APIはテナント用トランザクション内で
-- SET LOCAL ROLE kintai_app に切り替えてからクエリを実行する(AUTH-DESIGN.md「RLSポリシー」参照)。
-- ロールはクラスタ全体で共有されるため、既に存在する場合は作成しない
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kintai_app') THEN
    CREATE ROLE kintai_app NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
-- SET ROLE するには接続ユーザーがこのロールのメンバーである必要がある
GRANT kintai_app TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA "app", "core" TO kintai_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "app", "core" TO kintai_app;--> statement-breakpoint
-- 監査ログのUPDATE/DELETE禁止(CLAUDE.md 絶対ルール3)をDB側でも強制する
REVOKE UPDATE, DELETE ON "app"."audit_logs" FROM kintai_app;--> statement-breakpoint
-- 今後のマイグレーションで追加されるテーブルにも同じ権限を付ける
ALTER DEFAULT PRIVILEGES IN SCHEMA "app", "core" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kintai_app;--> statement-breakpoint

-- ─── RLSポリシー ────────────────────────────────────────────────────────────────
-- app.tenant_id が未設定のときは NULLIF で NULL になり、行が1件も返らない(キャストエラーにはしない)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'work_types', 'time_records', 'shift_patterns', 'shifts', 'requests', 'request_approvals',
    'billing_contracts', 'billing_contract_members', 'billing_summaries', 'notifications', 'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON app.%I '
      'USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) '
      'WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END
$$;
