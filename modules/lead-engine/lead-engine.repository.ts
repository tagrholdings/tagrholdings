import { withTenant } from "@/lib/db";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { leadApiUsageTable, leadRunsTable } from "./lead-engine.schema";
import type { UsageEventInput } from "./lead-engine.types";
import { searchProfilesTable } from "@/modules/search-profiles/search-profiles.schema";
import { rawLeadsTable } from "@/modules/leads/leads.schema";

// numeric/bigint aggregates come back from pg as strings — mapWith(Number)
// converts them at the query boundary (costs here are well inside float range).
const sumCost = sql<number>`coalesce(sum(${leadApiUsageTable.costUsd}), 0)`.mapWith(Number);

export const leadEngineRepository = {
  async recordUsage(tenantId: string, event: UsageEventInput) {
    await withTenant(tenantId, (tx) =>
      tx.insert(leadApiUsageTable).values({
        tenantId,
        runId: event.runId ?? null,
        provider: event.provider,
        operation: event.operation,
        model: event.model ?? null,
        requests: event.requests ?? 1,
        inputTokens: event.inputTokens ?? null,
        outputTokens: event.outputTokens ?? null,
        // numeric column: stored as text, 6 decimals like the job writes.
        costUsd: event.costUsd.toFixed(6),
      })
    );
  },

  /** Spend that belongs to no profile run (manual leads, inbound email). */
  async spendWithoutRun(tenantId: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ costUsd: sumCost })
        .from(leadApiUsageTable)
        .where(and(eq(leadApiUsageTable.tenantId, tenantId), isNull(leadApiUsageTable.runId)))
    );
    return row?.costUsd ?? 0;
  },

  /** Total / this-month / last-7-days spend in one pass. Cutoffs are computed by the caller (UTC). */
  async spendTotals(tenantId: string, monthStart: Date, weekStart: Date) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({
          total: sumCost,
          month: sql<number>`coalesce(sum(${leadApiUsageTable.costUsd}) filter (where ${leadApiUsageTable.createdAt} >= ${monthStart.toISOString()}::timestamp), 0)`.mapWith(Number),
          week: sql<number>`coalesce(sum(${leadApiUsageTable.costUsd}) filter (where ${leadApiUsageTable.createdAt} >= ${weekStart.toISOString()}::timestamp), 0)`.mapWith(Number),
        })
        .from(leadApiUsageTable)
        .where(eq(leadApiUsageTable.tenantId, tenantId))
    );
    return row ?? { total: 0, month: 0, week: 0 };
  },

  /** Every raw lead, whatever added it (a profile run, a manual add, an inbound email) — spend is counted the same way. */
  async totalLeadsAdded(tenantId: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(rawLeadsTable)
        .where(eq(rawLeadsTable.tenantId, tenantId))
    );
    return row?.value ?? 0;
  },

  async spendLines(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          provider: leadApiUsageTable.provider,
          operation: leadApiUsageTable.operation,
          model: leadApiUsageTable.model,
          requests: sql<number>`coalesce(sum(${leadApiUsageTable.requests}), 0)`.mapWith(Number),
          inputTokens: sql<number>`coalesce(sum(${leadApiUsageTable.inputTokens}), 0)`.mapWith(Number),
          outputTokens: sql<number>`coalesce(sum(${leadApiUsageTable.outputTokens}), 0)`.mapWith(Number),
          costUsd: sumCost,
        })
        .from(leadApiUsageTable)
        .where(eq(leadApiUsageTable.tenantId, tenantId))
        .groupBy(leadApiUsageTable.provider, leadApiUsageTable.operation, leadApiUsageTable.model)
        .orderBy(desc(sumCost))
    );
  },

  async dailySpend(tenantId: string, since: Date) {
    const day = sql<string>`to_char(date_trunc('day', ${leadApiUsageTable.createdAt}), 'YYYY-MM-DD')`;
    return withTenant(tenantId, (tx) =>
      tx
        .select({ date: day, costUsd: sumCost })
        .from(leadApiUsageTable)
        .where(and(eq(leadApiUsageTable.tenantId, tenantId), gte(leadApiUsageTable.createdAt, since)))
        .groupBy(day)
        .orderBy(day)
    );
  },

  async spendByProfile(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          searchProfileId: leadRunsTable.searchProfileId,
          searchProfileName: searchProfilesTable.name,
          costUsd: sumCost,
        })
        .from(leadApiUsageTable)
        .innerJoin(leadRunsTable, eq(leadApiUsageTable.runId, leadRunsTable.id))
        .innerJoin(searchProfilesTable, eq(leadRunsTable.searchProfileId, searchProfilesTable.id))
        .where(eq(leadApiUsageTable.tenantId, tenantId))
        .groupBy(leadRunsTable.searchProfileId, searchProfilesTable.name)
    );
  },

  async runStatsByProfile(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          searchProfileId: leadRunsTable.searchProfileId,
          searchProfileName: searchProfilesTable.name,
          runs: sql<number>`count(*)`.mapWith(Number),
          leadsAdded: sql<number>`coalesce(sum(${leadRunsTable.leadsAdded}), 0)`.mapWith(Number),
        })
        .from(leadRunsTable)
        .innerJoin(searchProfilesTable, eq(leadRunsTable.searchProfileId, searchProfilesTable.id))
        .where(eq(leadRunsTable.tenantId, tenantId))
        .groupBy(leadRunsTable.searchProfileId, searchProfilesTable.name)
    );
  },

  async recentRuns(tenantId: string, limit: number) {
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          id: leadRunsTable.id,
          searchProfileName: searchProfilesTable.name,
          status: leadRunsTable.status,
          startedAt: leadRunsTable.startedAt,
          finishedAt: leadRunsTable.finishedAt,
          candidatesSeen: leadRunsTable.candidatesSeen,
          leadsAdded: leadRunsTable.leadsAdded,
          emailSourcesDetected: leadRunsTable.emailSourcesDetected,
          error: leadRunsTable.error,
          costUsd: sql<number>`coalesce((select sum(u.cost_usd) from lead_api_usage u where u.run_id = ${leadRunsTable.id}), 0)`.mapWith(Number),
        })
        .from(leadRunsTable)
        .leftJoin(searchProfilesTable, eq(leadRunsTable.searchProfileId, searchProfilesTable.id))
        .where(eq(leadRunsTable.tenantId, tenantId))
        .orderBy(desc(leadRunsTable.startedAt))
        .limit(limit)
    );
  },
};
