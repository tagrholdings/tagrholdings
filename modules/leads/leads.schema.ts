import { pgTable, uuid, text, timestamp, jsonb, unique, foreignKey, index } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { tenantsTable, tenantIsolationPolicy, scraperTenantPolicy } from "@/modules/tenancy/tenancy.schema";
import { searchProfilesTable } from "@/modules/search-profiles/search-profiles.schema";
import { pipelineItemsTable } from "@/modules/pipeline/pipeline.schema";

export const LEAD_SOURCE_TYPES = [
  "google_places",
  "brave_search",
  "marketplace_scrape",
  "company_site_scrape",
  "email_digest",
  "manual_assist",
] as const;
export type LeadSourceType = (typeof LEAD_SOURCE_TYPES)[number];

export const RAW_LEAD_STATUSES = ["new", "processed", "dismissed"] as const;
export type RawLeadStatus = (typeof RAW_LEAD_STATUSES)[number];

/**
 * What the AI extraction stage pulled out of `rawText`. Deliberately loose:
 * every key is optional and the job may add new ones as sources are added
 * (LEAD_INGESTION.md: "don't hard-code rigid assumptions about this shape") —
 * readers must treat a missing/null key as "unknown", never as an error.
 */
export interface ExtractedFields {
  businessName?: string | null;
  industry?: string | null;
  summary?: string | null;
  location?: { address?: string | null; city?: string | null; state?: string | null } | null;
  website?: string | null;
  contact?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  estimatedRevenue?: string | null;
  askingPrice?: string | null;
  reasonForSelling?: string | null;
  employees?: string | null;
  yearsInBusiness?: string | null;
  /** Numeric twins of the text fields — only when the source stated the figure. What profile criteria are checked against. */
  estimatedRevenueUsd?: number | null;
  annualProfitUsd?: number | null;
  askingPriceUsd?: number | null;
  employeesCount?: number | null;
  yearsInBusinessCount?: number | null;
  /** Which of the profile's signal keywords the lead's text contains (set by the job). */
  matchedSignals?: string[] | null;
  /** Free text from whoever added the lead by hand (manual_assist). */
  note?: string | null;
  signals?: string[] | null;
  [key: string]: unknown;
}

/**
 * Every candidate the engine finds, whatever the source. WRITTEN by the external
 * job (role `lead_scraper`, `tenant_id` always taken from the originating search
 * profile); the app only reads it and flips `status`/`pipelineItemId` when the
 * user promotes or dismisses. Rows are never deleted — processed and dismissed
 * leads stay as history/audit trail.
 *
 * `dedupeKey` (place id, normalized URL, …) + the unique index make every write
 * idempotent: re-running a profile, or resuming a cut-short run, can't create
 * duplicates — and lets the job skip the (paid) extraction for known leads.
 */
export const rawLeadsTable = pgTable(
  "raw_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    searchProfileId: uuid("search_profile_id"),
    sourceType: text("source_type").$type<LeadSourceType>().notNull(),
    sourceUrl: text("source_url"),
    businessName: text("business_name").notNull(),
    rawText: text("raw_text"),
    extractedFields: jsonb("extracted_fields").$type<ExtractedFields>().notNull().default({}),
    status: text("status").$type<RawLeadStatus>().notNull().default("new"),
    dedupeKey: text("dedupe_key").notNull(),
    /** Set on promotion: which pipeline item this lead became. */
    pipelineItemId: uuid("pipeline_item_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("raw_leads_tenant_id_id_unique").on(t.tenantId, t.id),
    unique("raw_leads_tenant_source_dedupe_unique").on(t.tenantId, t.sourceType, t.dedupeKey),
    index("raw_leads_tenant_status_created_idx").on(t.tenantId, t.status, t.createdAt),
    foreignKey({
      name: "raw_leads_search_profile_same_tenant_fk",
      columns: [t.tenantId, t.searchProfileId],
      foreignColumns: [searchProfilesTable.tenantId, searchProfilesTable.id],
    }),
    foreignKey({
      name: "raw_leads_pipeline_item_same_tenant_fk",
      columns: [t.tenantId, t.pipelineItemId],
      foreignColumns: [pipelineItemsTable.tenantId, pipelineItemsTable.id],
    }),
    tenantIsolationPolicy("raw_leads"),
    scraperTenantPolicy("raw_leads", "select"),
    scraperTenantPolicy("raw_leads", "insert"),
  ]
);

export const selectRawLeadSchema = createSelectSchema(rawLeadsTable);
