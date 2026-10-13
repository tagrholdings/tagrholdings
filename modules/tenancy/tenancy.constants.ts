/**
 * Every table that holds a workspace's data, in an order that is safe to delete in (children before the rows they
 * reference): usage → runs → leads → activities → issues → entries → measurables/rocks → the other Traction tables →
 * seats → team people → items → boards → contacts → organizations → the rest.
 */
export const TENANT_DATA_TABLES = [
  "lead_api_usage",
  "lead_runs",
  "raw_leads",
  "activities",
  "traction_issues",
  "traction_entries",
  "traction_measurables",
  "traction_rocks",
  "traction_meetings",
  "traction_vto",
  "traction_people_reviews",
  "traction_processes",
  "traction_l10_settings",
  "traction_seats",
  "team_people",
  "pipeline_items",
  "pipeline_boards",
  "contacts",
  "organizations",
  "email_sources",
  "listing_sites",
  "search_profiles",
  "invites",
] as const;
