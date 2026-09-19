CREATE TABLE "lead_api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"model" text,
	"requests" integer DEFAULT 1 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_api_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lead_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"search_profile_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"candidates_seen" integer DEFAULT 0 NOT NULL,
	"leads_added" integer DEFAULT 0 NOT NULL,
	"error" text,
	CONSTRAINT "lead_runs_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "lead_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "raw_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"search_profile_id" uuid,
	"source_type" text NOT NULL,
	"source_url" text,
	"business_name" text NOT NULL,
	"raw_text" text,
	"extracted_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"dedupe_key" text NOT NULL,
	"pipeline_item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "raw_leads_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "raw_leads_tenant_source_dedupe_unique" UNIQUE("tenant_id","source_type","dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "raw_leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "search_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"radius_miles" integer DEFAULT 25 NOT NULL,
	"sources" jsonb NOT NULL,
	"max_leads_per_run" integer DEFAULT 25 NOT NULL,
	"frequency_hours" integer DEFAULT 24 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"run_state" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_profiles_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "search_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_api_usage" ADD CONSTRAINT "lead_api_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_api_usage" ADD CONSTRAINT "lead_api_usage_run_same_tenant_fk" FOREIGN KEY ("tenant_id","run_id") REFERENCES "public"."lead_runs"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_runs" ADD CONSTRAINT "lead_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_runs" ADD CONSTRAINT "lead_runs_search_profile_same_tenant_fk" FOREIGN KEY ("tenant_id","search_profile_id") REFERENCES "public"."search_profiles"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_leads" ADD CONSTRAINT "raw_leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_leads" ADD CONSTRAINT "raw_leads_search_profile_same_tenant_fk" FOREIGN KEY ("tenant_id","search_profile_id") REFERENCES "public"."search_profiles"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_leads" ADD CONSTRAINT "raw_leads_pipeline_item_same_tenant_fk" FOREIGN KEY ("tenant_id","pipeline_item_id") REFERENCES "public"."pipeline_items"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_profiles" ADD CONSTRAINT "search_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_api_usage_tenant_created_idx" ON "lead_api_usage" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_runs_tenant_started_idx" ON "lead_runs" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "raw_leads_tenant_status_created_idx" ON "raw_leads" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE POLICY "lead_api_usage_tenant_isolation" ON "lead_api_usage" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "lead_api_usage_scraper_select" ON "lead_api_usage" AS PERMISSIVE FOR SELECT TO "lead_scraper" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "lead_api_usage_scraper_insert" ON "lead_api_usage" AS PERMISSIVE FOR INSERT TO "lead_scraper" WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "lead_runs_tenant_isolation" ON "lead_runs" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "lead_runs_scraper_select" ON "lead_runs" AS PERMISSIVE FOR SELECT TO "lead_scraper" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "lead_runs_scraper_insert" ON "lead_runs" AS PERMISSIVE FOR INSERT TO "lead_scraper" WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "lead_runs_scraper_update" ON "lead_runs" AS PERMISSIVE FOR UPDATE TO "lead_scraper" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "raw_leads_tenant_isolation" ON "raw_leads" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "raw_leads_scraper_select" ON "raw_leads" AS PERMISSIVE FOR SELECT TO "lead_scraper" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "raw_leads_scraper_insert" ON "raw_leads" AS PERMISSIVE FOR INSERT TO "lead_scraper" WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "search_profiles_tenant_isolation" ON "search_profiles" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "search_profiles_scraper_select" ON "search_profiles" AS PERMISSIVE FOR SELECT TO "lead_scraper" USING (active);--> statement-breakpoint
CREATE POLICY "search_profiles_scraper_update" ON "search_profiles" AS PERMISSIVE FOR UPDATE TO "lead_scraper" USING (active) WITH CHECK (true);