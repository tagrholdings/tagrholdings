import { pgTable, uuid, text, timestamp, integer, numeric, unique, foreignKey, index } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { tenantsTable, tenantIsolationPolicy, scraperTenantPolicy } from "@/modules/tenancy/tenancy.schema";
import { searchProfilesTable } from "@/modules/search-profiles/search-profiles.schema";

export const RUN_STATUSES = ["running", "completed", "partial", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/**
 * One execution of one search profile by the external job. Written by the job
 * (`lead_scraper` role); the app reads it for the run history and to group
 * spend. `partial` = stopped by the time limit / a source failing, with a
 * checkpoint saved on the profile so the next run resumes.
 */
export const leadRunsTable = pgTable(
  "lead_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    searchProfileId: uuid("search_profile_id").notNull(),
    status: text("status").$type<RunStatus>().notNull().default("running"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
    /** Candidates seen this run (including ones already in the inbox). */
    candidatesSeen: integer("candidates_seen").notNull().default(0),
    /** New raw leads actually added. */
    leadsAdded: integer("leads_added").notNull().default(0),
    /** New "listings by email signup" sites the run logged into email_sources. */
    emailSourcesDetected: integer("email_sources_detected").notNull().default(0),
    error: text("error"),
  },
  (t) => [
    unique("lead_runs_tenant_id_id_unique").on(t.tenantId, t.id),
    index("lead_runs_tenant_started_idx").on(t.tenantId, t.startedAt),
    foreignKey({
      name: "lead_runs_search_profile_same_tenant_fk",
      columns: [t.tenantId, t.searchProfileId],
      foreignColumns: [searchProfilesTable.tenantId, searchProfilesTable.id],
    }),
    tenantIsolationPolicy("lead_runs"),
    scraperTenantPolicy("lead_runs", "select"),
    scraperTenantPolicy("lead_runs", "insert"),
    scraperTenantPolicy("lead_runs", "update"),
  ]
);

export const USAGE_PROVIDERS = ["openai", "google_places", "brave_search", "google_geocoding", "resend"] as const;
export type UsageProvider = (typeof USAGE_PROVIDERS)[number];

/**
 * One billable call the engine made. `costUsd` is the job's ESTIMATE at list
 * price when the call happened (token counts × the model's per-token rate,
 * request counts × the SKU's per-request rate) — it does not subtract free
 * monthly tiers/credits, so the real invoice can be lower. Kept per call (not
 * pre-aggregated) so the UI can slice by provider, operation, profile or run.
 */
export const leadApiUsageTable = pgTable(
  "lead_api_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    /** Null for spend that belongs to no profile run: manual leads, inbound email. */
    runId: uuid("run_id"),
    provider: text("provider").$type<UsageProvider>().notNull(),
    /** e.g. "text_search", "search", "geocode", "extract". */
    operation: text("operation").notNull(),
    model: text("model"),
    requests: integer("requests").notNull().default(1),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("lead_api_usage_tenant_created_idx").on(t.tenantId, t.createdAt),
    foreignKey({
      name: "lead_api_usage_run_same_tenant_fk",
      columns: [t.tenantId, t.runId],
      foreignColumns: [leadRunsTable.tenantId, leadRunsTable.id],
    }),
    tenantIsolationPolicy("lead_api_usage"),
    scraperTenantPolicy("lead_api_usage", "select"),
    scraperTenantPolicy("lead_api_usage", "insert"),
  ]
);

export const selectLeadRunSchema = createSelectSchema(leadRunsTable);
export const selectLeadApiUsageSchema = createSelectSchema(leadApiUsageTable);
