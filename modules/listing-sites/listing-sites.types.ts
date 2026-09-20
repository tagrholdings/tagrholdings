import { z } from "zod";
import type { ListingSiteOrigin, ListingSiteStatus } from "./listing-sites.schema";

/** Add a site by hand: only the address is needed — the name and domain are derived, the listings page is found by the crawler. */
export const createListingSiteSchema = z.object({
  siteUrl: z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL." }).max(2048),
  siteName: z.string().trim().max(200).optional(),
  /** If you already know the page that lists the businesses, give it — otherwise leave it blank. */
  listingsUrl: z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL." }).max(2048).optional().or(z.literal("")),
});
export type NewListingSite = z.infer<typeof createListingSiteSchema>;

export const setListingSiteActiveSchema = z.object({ id: z.uuid(), active: z.boolean() });

/** Client-side row shape — mirrors listingSitesRepository. */
export interface ListingSiteSummary {
  id: string;
  siteName: string;
  domain: string;
  siteUrl: string;
  listingsUrl: string | null;
  source: ListingSiteOrigin;
  active: boolean;
  status: ListingSiteStatus;
  statusDetail: string | null;
  lastCrawledAt: Date | null;
  lastListingCount: number;
  createdAt: Date;
}

/** Statuses that need a person: the crawler couldn't read the site, so nobody is looking at its listings. */
export function needsManualCheck(site: Pick<ListingSiteSummary, "active" | "status">): boolean {
  return site.active && (site.status === "blocked" || site.status === "error");
}
