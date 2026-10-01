import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * One row per browser/device that turned notifications on (a Web Push subscription). Per USER, not per workspace: a
 * device is the person's, so one subscription covers every workspace they belong to (a reminder is sent to the
 * members of the activity's workspace — see notifications.service.ts). No `tenant_id`, hence no RLS.
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
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)]
);
