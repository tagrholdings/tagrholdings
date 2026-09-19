-- Role for the external lead-discovery job (scraper/, a Python process — see
-- .agents/docs/LEAD_INGESTION.md and TENANCY.md). Unlike app_tenant this one
-- LOGINs directly: the job connects as it, so it never has BYPASSRLS (the app's
-- login role, neondb_owner, does, and can't lose it on Neon).
-- No password here — a migration must not carry a secret. After applying, run
-- once (Neon SQL editor, per branch):
--   ALTER ROLE lead_scraper PASSWORD '<generated>';
-- and put the resulting connection string in DATABASE_URL_SCRAPER (GitHub
-- Actions secret / scraper/.env).
-- Hand-written: drizzle-kit doesn't manage roles or grants in this project.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lead_scraper') THEN
    CREATE ROLE lead_scraper LOGIN NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO lead_scraper;
