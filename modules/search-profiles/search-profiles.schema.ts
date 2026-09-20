import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, uuid, text, timestamp, jsonb, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable, tenantIsolationPolicy, leadScraperRole } from "@/modules/tenancy/tenancy.schema";

/**
 * Which discovery sources a profile uses. Keys are the scraper's source ids
 * (scraper/src/leadengine/sources) — adding a source means adding a key here
 * AND a toggle in the profile form; a profile stored before a key existed is
 * read as "off" for it.
 */
export const profileSourcesSchema = z.object({
  google_places: z.boolean(),
  brave_search: z.boolean(),
  /** Finds business brokers by itself, reads their listing pages and saves each business FOR SALE in the profile's industries. */
  broker_listings: z.boolean(),
  company_site_scrape: z.boolean(),
  marketplace_scrape: z.boolean(),
});
export type ProfileSources = z.infer<typeof profileSourcesSchema>;

export const DEFAULT_PROFILE_SOURCES: ProfileSources = {
  google_places: true,
  brave_search: false,
  broker_listings: false,
  company_site_scrape: true,
  marketplace_scrape: false,
};

const usd = z.number().min(0).max(1_000_000_000_000);
const headcount = z.number().int().min(0).max(1_000_000);

/**
 * What a "good" lead looks like for this profile. Every field is optional —
 * blank means "no requirement". Amounts are whole US dollars per year.
 *
 * These ANNOTATE leads (a Match / Partial / Miss / Unknown "fit" badge on the
 * Leads Inbox); they never discard one. Most sources don't state revenue at
 * all, so filtering on them would silently throw away nearly everything — the
 * owner decides what a miss is worth. Checked against the numeric
 * `*Usd`/`*Count` fields of the extraction (modules/leads/leads.schema.ts) by
 * `evaluateFit()` in `fit.ts`; `signalKeywords` are matched by the job in the
 * lead's full text.
 */
export const qualificationCriteriaSchema = z
  .object({
    minRevenue: usd.optional(),
    maxRevenue: usd.optional(),
    /** Annual profit — cash flow / SDE / EBITDA / net profit, whichever the source states. */
    minProfit: usd.optional(),
    maxProfit: usd.optional(),
    /** Budget: the most you'd pay. */
    maxAskingPrice: usd.optional(),
    minEmployees: headcount.optional(),
    maxEmployees: headcount.optional(),
    minYearsInBusiness: headcount.optional(),
    /** Phrases like "retiring", "owner selling" — a lead mentioning one is flagged. */
    signalKeywords: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  })
  .superRefine((c, ctx) => {
    const pairs: [keyof typeof c, keyof typeof c, string][] = [
      ["minRevenue", "maxRevenue", "revenue"],
      ["minProfit", "maxProfit", "profit"],
      ["minEmployees", "maxEmployees", "employees"],
    ];
    for (const [lo, hi, label] of pairs) {
      const min = c[lo] as number | undefined;
      const max = c[hi] as number | undefined;
      if (min !== undefined && max !== undefined && min > max) {
        ctx.addIssue({ code: "custom", path: [hi], message: `Max ${label} must be at least the minimum.` });
      }
    }
  });
export type QualificationCriteria = z.infer<typeof qualificationCriteriaSchema>;

/** true when at least one requirement is set (an all-blank criteria object is stored as null). */
export function hasCriteria(criteria: QualificationCriteria | null | undefined): criteria is QualificationCriteria {
  if (!criteria) return false;
  return Object.values(criteria).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null));
}

/**
 * A saved, editable description of "what to look for and where" — the engine
 * reads active profiles on each scheduled run (see .agents/docs/LEAD_INGESTION.md).
 * Adding a new industry or region is filling out this form, never new code.
 *
 * `lastRunAt` + `runState` are written BY THE JOB (not the app): `runState` is
 * the resumable checkpoint (which source/keyword/page it stopped at, the cached
 * geocode of city+state), so a run cut short by the time limit picks up where it
 * left off. The app treats both as read-only.
 */
export const searchProfilesTable = pgTable(
  "search_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    city: text("city").notNull(),
    state: text("state").notNull(),
    radiusMiles: integer("radius_miles").notNull().default(25),
    sources: jsonb("sources").$type<ProfileSources>().notNull(),
    /** Hard cap on NEW leads one run may add for this profile — the main spend guard. */
    maxLeadsPerRun: integer("max_leads_per_run").notNull().default(25),
    /** Minimum hours between runs of this profile (the scheduler may tick more often). */
    frequencyHours: integer("frequency_hours").notNull().default(24),
    /** Qualification criteria (see qualificationCriteriaSchema); null = none set. */
    criteria: jsonb("criteria").$type<QualificationCriteria>(),
    active: boolean("active").notNull().default(true),
    /**
     * "Run now": set by the app, cleared by the job when it starts that run (so
     * a request made mid-run queues another). The job treats a profile with
     * this set as due regardless of `frequencyHours`.
     */
    runRequestedAt: timestamp("run_requested_at"),
    lastRunAt: timestamp("last_run_at"),
    runState: jsonb("run_state").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("search_profiles_tenant_id_id_unique").on(t.tenantId, t.id),
    tenantIsolationPolicy("search_profiles"),
    // The job's only cross-tenant access in the whole schema: it must be able
    // to list active profiles of every tenant to know what to run. It then
    // scopes everything else it does to that profile's tenant.
    pgPolicy("search_profiles_scraper_select", {
      as: "permissive",
      for: "select",
      to: leadScraperRole,
      using: sql`active`,
    }),
    pgPolicy("search_profiles_scraper_update", {
      as: "permissive",
      for: "update",
      to: leadScraperRole,
      using: sql`active`,
      withCheck: sql`true`,
    }),
  ]
);

export const insertSearchProfileSchema = createInsertSchema(searchProfilesTable, {
  name: (s) => s.min(1, "Name is required.").max(100),
  category: (s) => s.min(1, "Category is required.").max(100),
  keywords: z.array(z.string().trim().min(1).max(80)).max(20, "Up to 20 keywords."),
  city: (s) => s.min(1, "City is required.").max(100),
  state: (s) => s.min(2, "State is required.").max(50),
  radiusMiles: (s) => s.min(1).max(500),
  sources: profileSourcesSchema,
  maxLeadsPerRun: (s) => s.min(1, "At least 1.").max(200, "Up to 200 per run."),
  frequencyHours: (s) => s.min(1).max(24 * 30),
  criteria: qualificationCriteriaSchema.nullish(),
});
export const selectSearchProfileSchema = createSelectSchema(searchProfilesTable);
