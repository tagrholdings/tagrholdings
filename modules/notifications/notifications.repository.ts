import { db } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { pushSubscriptionsTable } from "./notifications.schema";
import type { SubscribePushInput } from "./notifications.types";

// Uses the unscoped `db`: push subscriptions belong to a person's device, not to a workspace (one subscription covers
// every workspace they are in), so the table has no tenant_id and no RLS. Which devices get a given reminder is decided
// in the service, from the members of the activity's workspace.
export const notificationsRepository = {
  /** Subscribing again from the same browser (same endpoint) refreshes its keys/owner instead of adding a row. */
  async upsert(userId: string, input: SubscribePushInput) {
    await db
      .insert(pushSubscriptionsTable)
      .values({
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent ?? null },
      });
  },

  /** Only the caller's own device: `userId` is part of the filter so nobody can drop a teammate's subscription. */
  async deleteOwnByEndpoint(userId: string, endpoint: string) {
    await db
      .delete(pushSubscriptionsTable)
      .where(and(eq(pushSubscriptionsTable.userId, userId), eq(pushSubscriptionsTable.endpoint, endpoint)));
  },

  async deleteByIds(ids: string[]) {
    if (ids.length === 0) return;
    await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.id, ids));
  },

  async findByUserIds(userIds: string[]) {
    if (userIds.length === 0) return [];
    return db
      .select({
        id: pushSubscriptionsTable.id,
        endpoint: pushSubscriptionsTable.endpoint,
        p256dh: pushSubscriptionsTable.p256dh,
        auth: pushSubscriptionsTable.auth,
      })
      .from(pushSubscriptionsTable)
      .where(inArray(pushSubscriptionsTable.userId, userIds));
  },
};
