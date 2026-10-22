import { db } from "@/lib/db";
import { and, eq, lt } from "drizzle-orm";
import { slackInstallationsTable, slackMessageClaimsTable, slackSentClaimsTable } from "./slack.schema";

// Uses the unscoped `db` on purpose: a Slack delivery names only a team and an app, so the webhook has to look the
// workspace up here BEFORE any tenant is known (same reason as the invite-token lookup). Neither table is reachable by
// the app_tenant role — no policy, no grant. Everything tenant-owned lives in slack.repository.ts, behind withTenant.
export const slackInstallationsRepository = {
  /** Every CRM workspace connected to this Slack team through this app — each with its own command channel. */
  async listForTeam(slackTeamId: string, apiAppId: string) {
    return db
      .select()
      .from(slackInstallationsTable)
      .where(and(eq(slackInstallationsTable.slackTeamId, slackTeamId), eq(slackInstallationsTable.apiAppId, apiAppId)));
  },

  async find(slackTeamId: string, apiAppId: string, tenantId: string) {
    const [row] = await db
      .select()
      .from(slackInstallationsTable)
      .where(and(eq(slackInstallationsTable.slackTeamId, slackTeamId), eq(slackInstallationsTable.apiAppId, apiAppId), eq(slackInstallationsTable.tenantId, tenantId)));
    return row;
  },

  /** What a workspace connected for the app of THIS environment (the settings page). */
  async findForTenant(tenantId: string, apiAppId: string) {
    const [row] = await db
      .select()
      .from(slackInstallationsTable)
      .where(and(eq(slackInstallationsTable.tenantId, tenantId), eq(slackInstallationsTable.apiAppId, apiAppId)));
    return row;
  },

  /**
   * Connects a workspace to a Slack team and its command channel (replacing what it had for this app). Several workspaces
   * may share a Slack team, but a channel is one workspace's: false when another workspace already uses it.
   */
  async upsertForTenant(tenantId: string, apiAppId: string, values: { slackTeamId: string; commandChannelId: string | null }) {
    if (values.commandChannelId) {
      const taken = await this.listForTeam(values.slackTeamId, apiAppId);
      if (taken.some((i) => i.commandChannelId === values.commandChannelId && i.tenantId !== tenantId)) return false;
    }
    await db.delete(slackInstallationsTable).where(and(eq(slackInstallationsTable.tenantId, tenantId), eq(slackInstallationsTable.apiAppId, apiAppId)));
    await db.insert(slackInstallationsTable).values({ slackTeamId: values.slackTeamId, apiAppId, tenantId, commandChannelId: values.commandChannelId });
    return true;
  },

  /**
   * First delivery of a message wins: true = process it, false = already seen (a Slack retry, or the second event of an
   * @mention in the command channel).
   */
  async claimMessage(apiAppId: string, channelId: string, messageTs: string) {
    const inserted = await db.insert(slackMessageClaimsTable).values({ apiAppId, channelId, messageTs }).onConflictDoNothing().returning({ ts: slackMessageClaimsTable.messageTs });
    return inserted.length > 0;
  },

  async deleteClaimsOlderThan(cutoff: Date) {
    await db.delete(slackMessageClaimsTable).where(lt(slackMessageClaimsTable.createdAt, cutoff));
    await db.delete(slackSentClaimsTable).where(lt(slackSentClaimsTable.createdAt, cutoff));
  },

  /** Every workspace connected through this app — what the notification sweep walks. */
  async listForApp(apiAppId: string) {
    return db.select().from(slackInstallationsTable).where(eq(slackInstallationsTable.apiAppId, apiAppId));
  },

  /** True the first time a key is claimed: the caller sends. False when it was already sent (or is being sent). */
  async claimSend(key: string) {
    const inserted = await db.insert(slackSentClaimsTable).values({ key }).onConflictDoNothing().returning({ key: slackSentClaimsTable.key });
    return inserted.length > 0;
  },

  /** Gives a key back — only when nothing was sent (the send was refused up front), so the next sweep may try again. */
  async releaseSend(key: string) {
    await db.delete(slackSentClaimsTable).where(eq(slackSentClaimsTable.key, key));
  },
};
