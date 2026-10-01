/**
 * Every table that holds a workspace's data, in an order that is safe to delete in (children before the rows they
 * reference): usage → runs → leads → activities → items → boards → contacts → organizations → the rest.
 */
export const TENANT_DATA_TABLES = [
  "lead_api_usage",
  "lead_runs",
  "raw_leads",
  "activities",
  "pipeline_items",
  "pipeline_boards",
  "contacts",
  "organizations",
  "email_sources",
  "listing_sites",
  "search_profiles",
  "invites",
] as const;
