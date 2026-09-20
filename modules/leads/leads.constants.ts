import type { LeadSourceType } from "./leads.schema";

export const SOURCE_LABELS: Record<LeadSourceType, string> = {
  google_places: "Google Places",
  brave_search: "Brave Search",
  marketplace_scrape: "Marketplace",
  broker_listings: "Broker listing",
  company_site_scrape: "Company site",
  email_digest: "Email digest",
  manual_assist: "Added by hand",
};
