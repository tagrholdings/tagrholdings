-- Grants for listing_sites (0015 adds the table + policies; grants aren't managed by drizzle-kit, see 0004).
-- Least privilege on both sides: RLS decides WHICH rows, these decide WHICH operations/columns.

-- The app (withTenant -> app_tenant): lists sites, adds one by hand, and toggles `active` ("ignore" / "use again").
-- Sites are never deleted, and the crawl bookkeeping is the job's: the app can write no other column.
GRANT SELECT, INSERT ON listing_sites TO app_tenant;
--> statement-breakpoint
GRANT UPDATE (active, updated_at) ON listing_sites TO app_tenant;
--> statement-breakpoint

-- The external job (lead_scraper): reads its tenant's sites, adds sites it discovers (the insert policy pins
-- source = 'auto_detected' and active), and records what each crawl found. It can never change `active`,
-- `source`, the name/domain/url of an existing site, or delete one.
GRANT SELECT ON listing_sites TO lead_scraper;
--> statement-breakpoint
GRANT INSERT (tenant_id, site_name, domain, site_url, listings_url, source) ON listing_sites TO lead_scraper;
--> statement-breakpoint
GRANT UPDATE (listings_url, status, status_detail, last_crawled_at, last_listing_count, content_hashes, updated_at) ON listing_sites TO lead_scraper;
