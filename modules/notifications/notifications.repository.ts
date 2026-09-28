import { withTenant } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { pushSubscriptionsTable } from "./notifications.schema";
import type { SubscribePushInput } from "./notifications.types";

export const notificationsRepository = {
  /** Subscribing again from the same browser (same endpoint) refreshes its keys/owner instead of adding a row. */
  async upsert(tenantId: string, userId: string, input: SubscribePushInput) {
    await withTenant(tenantId, (tx) =>
      tx
        .insert(pushSubscriptionsTable)
        .values({
          tenantId,
          userId,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
        })
        .onConflictDoUpdate({
          target: pushSubscriptionsTable.endpoint,
          set: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent ?? null },
        })
    );
  },

  /** Only the caller's own device: `userId` is part of the filter so nobody can drop a teammate's subscription. */
  async deleteOwnByEndpoint(tenantId: string, userId: string, endpoint: string) {
    await withTenant(tenantId, (tx) =>
      tx
        .delete(pushSubscriptionsTable)
        .where(
          and(
            eq(pushSubscriptionsTable.tenantId, tenantId),
            eq(pushSubscriptionsTable.userId, userId),
            eq(pushSubscriptionsTable.endpoint, endpoint)
          )
        )
    );
  },

  async deleteByIds(tenantId: string, ids: string[]) {
    if (ids.length === 0) return;
    await withTenant(tenantId, (tx) =>
      tx.delete(pushSubscriptionsTable).where(and(eq(pushSubscriptionsTable.tenantId, tenantId), inArray(pushSubscriptionsTable.id, ids)))
    );
  },

  async findByUserIds(tenantId: string, userIds: string[]) {
    if (userIds.length === 0) return [];
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          id: pushSubscriptionsTable.id,
          endpoint: pushSubscriptionsTable.endpoint,
          p256dh: pushSubscriptionsTable.p256dh,
          auth: pushSubscriptionsTable.auth,
        })
        .from(pushSubscriptionsTable)
        .where(and(eq(pushSubscriptionsTable.tenantId, tenantId), inArray(pushSubscriptionsTable.userId, userIds)))
    );
  },
};
