-- The "Google Search" discovery source (Google Custom Search JSON API) is replaced by
-- Brave Search: Google no longer allows open-web search on new engines. The source id
-- stored in data changes from 'google_custom_search' to 'brave_search'.
-- Data-only migration (no schema change): source ids live in jsonb keys and text
-- columns, not in a DB enum. The old source was never run against the real API, so
-- there is normally nothing to rename in raw_leads / lead_api_usage — they're updated
-- anyway so a branch that did hold rows stays consistent.

-- A profile that had Google Search switched on now has Brave Search switched on
-- (same purpose: find company websites by keyword); the old key is dropped.
UPDATE search_profiles
SET sources = (sources - 'google_custom_search')
              || jsonb_build_object('brave_search', coalesce((sources ->> 'google_custom_search')::boolean, false))
WHERE sources ? 'google_custom_search';
--> statement-breakpoint
UPDATE raw_leads SET source_type = 'brave_search' WHERE source_type = 'google_custom_search';
--> statement-breakpoint
UPDATE lead_api_usage SET provider = 'brave_search' WHERE provider = 'google_custom_search';
