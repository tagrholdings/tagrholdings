import type { UsageProvider } from "./lead-engine.schema";

export const PROVIDER_LABELS: Record<UsageProvider, string> = {
  openai: "OpenAI (AI extraction)",
  google_places: "Google Places",
  brave_search: "Brave Search",
  google_geocoding: "Google Geocoding",
  resend: "Resend (inbound email)",
};

/** Human names for the `operation` column the job writes. Unknown ones fall back to the raw value. */
export const OPERATION_LABELS: Record<string, string> = {
  text_search: "Business search",
  search: "Web search",
  geocode: "Location lookup",
  extract: "Lead data extraction",
  receive: "Email received",
};
