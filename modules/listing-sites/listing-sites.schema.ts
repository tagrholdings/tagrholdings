import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, uuid, text, boolean, integer, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable, tenantIsolationPolicy, scraperTenantPolicy, leadScraperRole } from "@/modules/tenancy/tenancy.schema";

/** Who put the site on the list: a person ("manual") or a search profile run that found it ("auto_detected"). */
export const LISTING_SITE_ORIGINS = ["manual", "auto_detected"] as const;
export type ListingSiteOrigin = (typeof LISTING_SITE_ORIGINS)[number];

/**
 * What the last crawl found:
 *   pending     never crawled yet
 *   ok          read, and at least one business for sale was extracted (or the page hadn't changed since)
 *   blocked     the site refused the crawler (robots.txt / 401 / 403 / 429) — we do NOT work around it: a person checks it by hand
 *   no_listings read fine but no listings were found (an association/directory, or a page that only renders with JavaScript)
 *   error       a network or parsing failure; retried on a later run
 */
export const LISTING_SITE_STATUSES = ["pending", "ok", "blocked", "no_listings", "error"] as const;
export type ListingSiteStatus = (typeof LISTING_SITE_STATUSES)[number];

/**
 * A business broker / listing site the engine reads for businesses that are FOR SALE. Sites are found by the
 * "Broker listing sites" source of a search profile (Brave search for brokers in the profile's region and
 * industries), or added by hand. The crawl itself is done by the external job (scraper/): it reads each active
 * site's listings pages, extracts every business listed and saves each as a raw lead.
 *
 * Job-owned columns (status, statusDetail, lastCrawledAt, lastListingCount, listingsUrl, contentHashes): the app
 * never writes them. `contentHashes` remembers a hash of each page's text per search profile, so a page that hasn't
 * changed since the last run costs no AI call.
 *
 * Sites are never deleted — `active = false` ("ignore") keeps a site from being crawled AND from being
 * re-discovered on the next run.
 */
export const listingSitesTable = pgTable(
  "listing_sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    siteName: text("site_name").notNull(),
    /** Registrable domain ("example.com") — one row per site, whatever page it was found on. */
    domain: text("domain").notNull(),
    /** Where to start: the site's homepage (or whatever page was given). */
    siteUrl: text("site_url").notNull(),
    /** The page that lists the businesses for sale, once the job has found it. */
    listingsUrl: text("listings_url"),
    source: text("source").$type<ListingSiteOrigin>().notNull().default("manual"),
    active: boolean("active").notNull().default(true),
    status: text("status").$type<ListingSiteStatus>().notNull().default("pending"),
    /** Human-readable detail for the status: why it was blocked, what went wrong. */
    statusDetail: text("status_detail"),
    lastCrawledAt: timestamp("last_crawled_at"),
    lastListingCount: integer("last_listing_count").notNull().default(0),
    contentHashes: jsonb("content_hashes").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("listing_sites_tenant_id_id_unique").on(t.tenantId, t.id),
    unique("listing_sites_tenant_domain_unique").on(t.tenantId, t.domain),
    tenantIsolationPolicy("listing_sites"),
    // The job works inside one tenant (the search profile's): it reads that tenant's sites and records crawl outcomes...
    scraperTenantPolicy("listing_sites", "select"),
    scraperTenantPolicy("listing_sites", "update"),
    // ...and may add sites it discovers — only as active, auto-detected rows. The column-level INSERT/UPDATE grants
    // (migration 0016) narrow what it can write further.
    pgPolicy("listing_sites_scraper_insert", {
      as: "permissive",
      for: "insert",
      to: leadScraperRole,
      withCheck: sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid and source = 'auto_detected' and active`,
    }),
  ]
);

/** http(s) only — this URL is shown as a link and opened by the crawler. */
const httpUrl = z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL." }).max(2048);

export const insertListingSiteSchema = createInsertSchema(listingSitesTable, {
  siteName: z.string().trim().max(200).optional(),
  siteUrl: httpUrl,
  listingsUrl: httpUrl.nullish(),
});
