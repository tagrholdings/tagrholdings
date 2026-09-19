CREATE TABLE "email_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_name" text NOT NULL,
	"signup_url" text NOT NULL,
	"email_field_selector" text,
	"submit_selector" text,
	"subscribed" boolean DEFAULT false NOT NULL,
	"captcha_protected" boolean DEFAULT false NOT NULL,
	"notes" text,
	"subscribed_at" timestamp,
	"attempt_requested_at" timestamp,
	"last_attempt_at" timestamp,
	"last_attempt_result" text,
	"last_attempt_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_sources_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "email_sources_tenant_signup_url_unique" UNIQUE("tenant_id","signup_url")
);
--> statement-breakpoint
ALTER TABLE "email_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_api_usage" ALTER COLUMN "run_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "search_profiles" ADD COLUMN "criteria" jsonb;--> statement-breakpoint
ALTER TABLE "search_profiles" ADD COLUMN "run_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_sources" ADD CONSTRAINT "email_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "email_sources_tenant_isolation" ON "email_sources" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "email_sources_scraper_select" ON "email_sources" AS PERMISSIVE FOR SELECT TO "lead_scraper" USING (not subscribed and not captcha_protected);--> statement-breakpoint
CREATE POLICY "email_sources_scraper_update" ON "email_sources" AS PERMISSIVE FOR UPDATE TO "lead_scraper" USING (not subscribed and not captcha_protected) WITH CHECK (true);