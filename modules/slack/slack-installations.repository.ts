import { db } from "@/lib/db";
import { and, eq, lt } from "drizzle-orm";
import { slackInstallationsTable, slackMessageClaimsTable } from "./slack.schema";

// Uses the unscoped `db` on purpose: a Slack delivery names only a team and an app, so the webhook has to look the
// workspace up here BEFORE any tenant is known (same reason as the invite-token lookup). Neither table is reachable by
// the app_tenant role — no policy, no grant. Everything tenant-owned lives in slack.repository.ts, behind withTenant.
export const slackInstallationsRepository = {
  async find(slackTeamId: string, apiAppId: string) {
    const [row] = await db
      .select()
      .from(slackInstallationsTable)
      .where(and(eq(slackInstallationsTable.slackTeamId, slackTeamId), eq(slackInstallationsTable.apiAppId, apiAppId)));
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

  /** One workspace per (team, app): connecting again moves it. Returns false when that team is already another workspace's. */
  async upsertForTenant(tenantId: string, apiAppId: string, values: { slackTeamId: string; commandChannelId: string | null }) {
    const existing = await this.find(values.slackTeamId, apiAppId);
    if (existing && existing.tenantId !== tenantId) return false;

    // This workspace connects ONE Slack team per app: a different team id replaces the old row.
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
  },
};
