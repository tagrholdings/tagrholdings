import { withTenant } from "@/lib/db";
import { and, eq, inArray, lt } from "drizzle-orm";
import { slackPendingActionsTable, slackUserLinksTable } from "./slack.schema";
import type { PendingPayload } from "./slack.types";

export const slackRepository = {
  async findLink(tenantId: string, slackUserId: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(slackUserLinksTable)
        .where(and(eq(slackUserLinksTable.tenantId, tenantId), eq(slackUserLinksTable.slackUserId, slackUserId)))
    );
    return row;
  },

  async findLinkByUser(tenantId: string, userId: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(slackUserLinksTable)
        .where(and(eq(slackUserLinksTable.tenantId, tenantId), eq(slackUserLinksTable.userId, userId)))
    );
    return row;
  },

  /** What a person chose to be messaged about, and their zone — only their own row is ever touched. */
  async updateLink(tenantId: string, slackUserId: string, patch: Partial<Pick<typeof slackUserLinksTable.$inferInsert, "timeZone" | "remindDm" | "l10Dm" | "digestDm" | "weeklyDm">>) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(slackUserLinksTable)
        .set(patch)
        .where(and(eq(slackUserLinksTable.tenantId, tenantId), eq(slackUserLinksTable.slackUserId, slackUserId)))
        .returning()
    );
    return row;
  },

  async findLinks(tenantId: string) {
    return withTenant(tenantId, (tx) => tx.select().from(slackUserLinksTable).where(eq(slackUserLinksTable.tenantId, tenantId)));
  },

  /** Linking again (same Slack user) re-points it at the current login. */
  async upsertLink(tenantId: string, slackUserId: string, userId: string, timeZone: string | null = null) {
    await withTenant(tenantId, (tx) =>
      tx
        .insert(slackUserLinksTable)
        .values({ tenantId, slackUserId, userId, timeZone })
        .onConflictDoUpdate({ target: [slackUserLinksTable.tenantId, slackUserLinksTable.slackUserId], set: { userId, ...(timeZone ? { timeZone } : {}) } })
    );
  },

  async deleteLink(tenantId: string, slackUserId: string) {
    await withTenant(tenantId, (tx) =>
      tx.delete(slackUserLinksTable).where(and(eq(slackUserLinksTable.tenantId, tenantId), eq(slackUserLinksTable.slackUserId, slackUserId)))
    );
  },

  async insertPending(tenantId: string, values: { slackUserId: string; payload: PendingPayload; channelId: string; expiresAt: Date }) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(slackPendingActionsTable)
        .values({ tenantId, slackUserId: values.slackUserId, kind: values.payload.kind, payload: values.payload, channelId: values.channelId, expiresAt: values.expiresAt })
        .returning()
    );
    return row;
  },

  async setCardTs(tenantId: string, id: string, cardTs: string) {
    await withTenant(tenantId, (tx) =>
      tx.update(slackPendingActionsTable).set({ cardTs }).where(and(eq(slackPendingActionsTable.tenantId, tenantId), eq(slackPendingActionsTable.id, id)))
    );
  },

  async findPending(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(slackPendingActionsTable)
        .where(and(eq(slackPendingActionsTable.tenantId, tenantId), eq(slackPendingActionsTable.id, id)))
    );
    return row;
  },

  /** The still-pending cards among these messages of a channel — the bot's earlier proposals in one thread. */
  async findPendingByCards(tenantId: string, channelId: string, cardTss: string[]) {
    if (cardTss.length === 0) return [];
    return withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(slackPendingActionsTable)
        .where(
          and(
            eq(slackPendingActionsTable.tenantId, tenantId),
            eq(slackPendingActionsTable.channelId, channelId),
            eq(slackPendingActionsTable.status, "pending"),
            inArray(slackPendingActionsTable.cardTs, cardTss)
          )
        )
    );
  },

  /** Moves a still-pending card to `status` — atomically, so two clicks on Create can't both win. Null when it already moved. */
  async claimPending(tenantId: string, id: string, status: "done" | "cancelled") {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(slackPendingActionsTable)
        .set({ status })
        .where(and(eq(slackPendingActionsTable.tenantId, tenantId), eq(slackPendingActionsTable.id, id), eq(slackPendingActionsTable.status, "pending")))
        .returning()
    );
    return row ?? null;
  },

  /** Puts a claimed card back to pending — the write it was claimed for failed, so the person can press the button again. */
  async releasePending(tenantId: string, id: string) {
    await withTenant(tenantId, (tx) =>
      tx.update(slackPendingActionsTable).set({ status: "pending" }).where(and(eq(slackPendingActionsTable.tenantId, tenantId), eq(slackPendingActionsTable.id, id)))
    );
  },

  async deleteExpired(tenantId: string, now: Date) {
    await withTenant(tenantId, (tx) =>
      tx.delete(slackPendingActionsTable).where(and(eq(slackPendingActionsTable.tenantId, tenantId), lt(slackPendingActionsTable.expiresAt, now)))
    );
  },
};
