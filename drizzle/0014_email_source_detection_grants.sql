-- Grants for auto-detected email sources (0013 adds the policies; grants aren't managed by drizzle-kit, see 0004).
--
-- During a search profile run the job may log a site that offers listings only by email signup: it INSERTs one
-- email_sources row. Least privilege: column-level, so the job can never write `subscribed`, `subscribed_at`,
-- `captcha_protected` or any attempt bookkeeping on the way in (they take their defaults: not subscribed, no captcha
-- flag), and the insert policy additionally pins source = 'auto_detected'. Reading every row of its tenant (to
-- avoid logging a domain twice) comes from the table-level SELECT granted in 0011 plus the tenant policy in 0013.
GRANT INSERT (tenant_id, site_name, signup_url, email_field_selector, submit_selector, notes, source)
  ON email_sources TO lead_scraper;
