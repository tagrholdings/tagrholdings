-- Table grants for the lead-engine tables (drizzle-kit doesn't manage grants —
-- see 0004). Least privilege on both sides: RLS (0007) decides WHICH rows,
-- these decide WHICH operations/columns at all.

-- The app (withTenant → app_tenant). Profiles are edited from the UI but never
-- deleted (raw leads and runs reference them — pause one instead). Raw leads
-- are only read and status-flipped here; the job is the writer. Runs and API
-- usage are read-only for the app (they feed the run history and spend pages).
GRANT SELECT, INSERT, UPDATE ON search_profiles TO app_tenant;
--> statement-breakpoint
GRANT SELECT, UPDATE ON raw_leads TO app_tenant;
--> statement-breakpoint
GRANT SELECT ON lead_runs, lead_api_usage TO app_tenant;
--> statement-breakpoint

-- The external job (lead_scraper). On search_profiles it can only touch the two
-- checkpoint columns it owns — never a tenant_id, an active flag or a source
-- toggle, so a job bug can't reconfigure or reassign a profile.
GRANT SELECT ON search_profiles TO lead_scraper;
--> statement-breakpoint
GRANT UPDATE (last_run_at, run_state) ON search_profiles TO lead_scraper;
--> statement-breakpoint
GRANT SELECT, INSERT ON raw_leads TO lead_scraper;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON lead_runs TO lead_scraper;
--> statement-breakpoint
GRANT SELECT, INSERT ON lead_api_usage TO lead_scraper;
