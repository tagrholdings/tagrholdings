import { pgTable, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";

/**
 * Fixed-window counters for public endpoints (e.g. /api/contact). Lives in
 * Postgres rather than process memory because serverless instances don't
 * share memory and are recycled constantly — an in-memory counter resets on
 * every cold start. No `tenantId`: these are request counters for anonymous
 * traffic, not data that belongs to a company.
 */
export const rateLimitBucketsTable = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start").notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })]
);
