CREATE TABLE "listing_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_name" text NOT NULL,
	"domain" text NOT NULL,
	"site_url" text NOT NULL,
	"listings_url" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_detail" text,
	"last_crawled_at" timestamp,
	"last_listing_count" integer DEFAULT 0 NOT NULL,
	"content_hashes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listing_sites_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "listing_sites_tenant_domain_unique" UNIQUE("tenant_id","domain")
);
--> statement-breakpoint
ALTER TABLE "listing_sites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "listing_sites" ADD CONSTRAINT "listing_sites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "listing_sites_tenant_isolation" ON "listing_sites" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "listing_sites_scraper_select" ON "listing_sites" AS PERMISSIVE FOR SELECT TO "lead_scraper" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "listing_sites_scraper_update" ON "listing_sites" AS PERMISSIVE FOR UPDATE TO "lead_scraper" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "listing_sites_scraper_insert" ON "listing_sites" AS PERMISSIVE FOR INSERT TO "lead_scraper" WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid and source = 'auto_detected' and active);