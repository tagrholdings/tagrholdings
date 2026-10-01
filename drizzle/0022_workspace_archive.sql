ALTER TABLE "tenants" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
-- Grants aren't managed by drizzle-kit (see 0004). The lead engine skips archived workspaces, so it needs to read this one column.
GRANT SELECT ("archived_at") ON "tenants" TO lead_scraper;
