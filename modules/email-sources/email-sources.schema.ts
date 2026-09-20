import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, uuid, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable, tenantIsolationPolicy, leadScraperRole } from "@/modules/tenancy/tenancy.schema";

/** Who put the row on the list: a person ("manual") or the engine, spotting a signup-only page during a run. */
export const EMAIL_SOURCE_ORIGINS = ["manual", "auto_detected"] as const;
export type EmailSourceOrigin = (typeof EMAIL_SOURCE_ORIGINS)[number];

/**
 * submitted: the form went out (NOT a subscription yet — the confirmation email does that)
 * captcha:   a captcha is in the form; never solved or bypassed
 * manual:    the form asks for something the engine must not or cannot supply (a password/account, an NDA or terms
 *            to accept, a last name it wasn't given...) — `lastAttemptError` says what, for the person who does it by hand
 * failed:    something broke (selector not found, timeout)
 */
export const SIGNUP_ATTEMPT_RESULTS = ["submitted", "captcha", "manual", "failed"] as const;
export type SignupAttemptResult = (typeof SIGNUP_ATTEMPT_RESULTS)[number];

/**
 * Listing sites that deliver their listings by EMAIL instead of a browsable page.
 * A person adds sites here, and search profile runs add the ones they stumble on
 * (`source = "auto_detected"`, a precision-first heuristic — see
 * scraper/src/leadengine/enrich/email_signup_detect.py). Detection can't be
 * trusted to be complete, so the list stays open to manual additions. What CAN be
 * automated is the signup itself (when the form has no captcha) and the
 * confirmation click:
 *
 *   1. the job (scraper/, Playwright) fills the dedicated inbox address into the form
 *      using the two selectors below and submits — never solving or bypassing a captcha
 *      (a captcha marks `captchaProtected` and stops: that site stays a manual signup);
 *   2. the site emails a confirmation link (double opt-in) to the inbox;
 *   3. the Resend inbound webhook recognises the confirmation and clicks the link,
 *      then sets `subscribed` — see modules/email-inbound.
 *
 * `subscribed` is only ever set by step 3 (or by hand): a submitted form is not a
 * subscription yet. The `lastAttempt*` columns are job-owned and stop the job
 * re-submitting the form on every scheduled run.
 */
export const emailSourcesTable = pgTable(
  "email_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    siteName: text("site_name").notNull(),
    signupUrl: text("signup_url").notNull(),
    /** CSS selector of the signup form's email input. Null = not configured → never auto-attempted. */
    emailFieldSelector: text("email_field_selector"),
    /** CSS selector of the submit button. */
    submitSelector: text("submit_selector"),
    subscribed: boolean("subscribed").notNull().default(false),
    captchaProtected: boolean("captcha_protected").notNull().default(false),
    notes: text("notes"),
    /** "manual" = added in the CRM; "auto_detected" = logged by a search profile run (enrich/email_signup_detect.py). */
    source: text("source").$type<EmailSourceOrigin>().notNull().default("manual"),
    subscribedAt: timestamp("subscribed_at"),
    /** Set by the app ("Attempt subscribe"); the job clears it when it starts the attempt. */
    attemptRequestedAt: timestamp("attempt_requested_at"),
    lastAttemptAt: timestamp("last_attempt_at"),
    lastAttemptResult: text("last_attempt_result").$type<SignupAttemptResult>(),
    lastAttemptError: text("last_attempt_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("email_sources_tenant_id_id_unique").on(t.tenantId, t.id),
    unique("email_sources_tenant_signup_url_unique").on(t.tenantId, t.signupUrl),
    tenantIsolationPolicy("email_sources"),
    // The job reads (and records attempts on) only sources still waiting for a
    // subscription — across tenants, like search profiles, since it has to discover
    // which tenants have work. It does NOT filter on captcha_protected here: Postgres
    // also checks an UPDATE's NEW row against the SELECT policy, so a policy of
    // "not captcha_protected" would reject the very update that sets it (found by
    // running the job against the real database). The job's query skips captcha rows itself.
    pgPolicy("email_sources_scraper_select", {
      as: "permissive",
      for: "select",
      to: leadScraperRole,
      using: sql`not subscribed`,
    }),
    pgPolicy("email_sources_scraper_update", {
      as: "permissive",
      for: "update",
      to: leadScraperRole,
      using: sql`not subscribed`,
      withCheck: sql`true`,
    }),
    // Auto-detection: during a run the job works inside one tenant. To avoid logging a site twice it must SEE every
    // source of that tenant (subscribed or not, added by hand or earlier by itself) — the policy above only shows
    // unsubscribed rows — and it may INSERT, but only a fresh auto_detected row: unsubscribed, no captcha flag. The
    // column-level INSERT grant (0013) narrows the writable columns as well.
    pgPolicy("email_sources_scraper_tenant_select", {
      as: "permissive",
      for: "select",
      to: leadScraperRole,
      using: sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`,
    }),
    pgPolicy("email_sources_scraper_tenant_insert", {
      as: "permissive",
      for: "insert",
      to: leadScraperRole,
      withCheck: sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid and source = 'auto_detected' and not subscribed and not captcha_protected`,
    }),
  ]
);

/** http(s) only — this URL is rendered as a link and opened by a browser automation. */
const httpUrl = z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL." }).max(2048);

export const insertEmailSourceSchema = createInsertSchema(emailSourcesTable, {
  siteName: (s) => s.trim().min(1, "Site name is required.").max(200),
  signupUrl: httpUrl,
  emailFieldSelector: z.string().trim().max(300).nullish(),
  submitSelector: z.string().trim().max(300).nullish(),
  notes: z.string().trim().max(5000).nullish(),
});
export const selectEmailSourceSchema = createSelectSchema(emailSourcesTable);
