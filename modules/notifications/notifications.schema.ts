import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";

/**
 * One row per browser/device that turned notifications on (a Web Push subscription).
 * `endpoint` is the push service's URL for that browser and is globally unique, so subscribing again from the
 * same browser updates the row instead of duplicating it. `p256dh` + `auth` are the keys the payload is encrypted
 * with. Rows are removed when the person turns notifications off, or when the push service says the
 * subscription is gone (404/410).
 *
 * `userId` is a Neon Auth user id (no FK possible — see activities.schema.ts's assignedToUserId).
 */
export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_tenant_user_idx").on(t.tenantId, t.userId), tenantIsolationPolicy("push_subscriptions")]
);
