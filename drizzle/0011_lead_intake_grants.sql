-- Grants for lead intake beyond the scheduled scraper: manual leads (POST /api/leads/ingest and the
-- Leads Inbox quick-add), inbound email (Resend webhook), the email-source tracking list, and
-- "Run now". Least privilege as in 0008; RLS (0010) still decides WHICH rows.

-- The app now also CREATES raw leads (it used to only read/flip them; the job was the sole writer)
-- and records the AI/inbound-email spend those leads cost.
GRANT INSERT ON raw_leads TO app_tenant;
--> statement-breakpoint
GRANT INSERT ON lead_api_usage TO app_tenant;
--> statement-breakpoint

-- The email-source list is plain CRUD for the app.
GRANT SELECT, INSERT, UPDATE, DELETE ON email_sources TO app_tenant;
--> statement-breakpoint

-- The job: reads sources still waiting for a subscription, and may write ONLY the attempt outcome
-- (never the URL, selectors, or the `subscribed` flag — that is set by the confirmation click).
GRANT SELECT ON email_sources TO lead_scraper;
--> statement-breakpoint
GRANT UPDATE (captcha_protected, attempt_requested_at, last_attempt_at, last_attempt_result, last_attempt_error, updated_at)
  ON email_sources TO lead_scraper;
--> statement-breakpoint

-- "Run now": the job clears the request flag when it picks the run up.
GRANT UPDATE (run_requested_at) ON search_profiles TO lead_scraper;
