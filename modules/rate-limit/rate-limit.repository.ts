import { db } from "@/lib/db";
import { lt, sql } from "drizzle-orm";
import { rateLimitBucketsTable } from "./rate-limit.schema";

// Unscoped `db`: rate-limit buckets are anonymous request counters, not
// tenant data (see rate-limit.schema.ts).
export const rateLimitRepository = {
  /** Atomically adds one hit to `key`'s bucket for `windowStart` and returns the bucket's new total. */
  async increment(key: string, windowStart: Date) {
    const [row] = await db
      .insert(rateLimitBucketsTable)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimitBucketsTable.key, rateLimitBucketsTable.windowStart],
        set: { count: sql`${rateLimitBucketsTable.count} + 1` },
      })
      .returning({ count: rateLimitBucketsTable.count });
    return row.count;
  },

  async deleteOlderThan(cutoff: Date) {
    await db.delete(rateLimitBucketsTable).where(lt(rateLimitBucketsTable.windowStart, cutoff));
  },
};
