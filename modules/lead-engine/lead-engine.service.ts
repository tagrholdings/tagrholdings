import { leadEngineRepository } from "./lead-engine.repository";
import type { DailySpend, SpendByProfile, SpendReport, SpendTotals, UsageEventInput } from "./lead-engine.types";

const DAILY_WINDOW_DAYS = 30;
const RECENT_RUNS = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Costs are estimates at list price — round only for display, keep full precision here. */
export const leadEngineService = {
  /** Logs one billable call made by the app itself (AI extraction of a manual/email lead, an inbound email). */
  async recordUsage(tenantId: string, event: UsageEventInput) {
    await leadEngineRepository.recordUsage(tenantId, event);
  },

  async getSpendTotals(tenantId: string, now = new Date()): Promise<SpendTotals> {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const weekStart = new Date(startOfUtcDay(now).getTime() - 6 * DAY_MS);
    const [totals, leadsAdded] = await Promise.all([
      leadEngineRepository.spendTotals(tenantId, monthStart, weekStart),
      leadEngineRepository.totalLeadsAdded(tenantId),
    ]);
    return {
      totalUsd: totals.total,
      monthUsd: totals.month,
      last7DaysUsd: totals.week,
      leadsAdded,
      costPerLeadUsd: leadsAdded > 0 ? totals.total / leadsAdded : null,
    };
  },

  /** Everything the spend page shows, fetched in parallel. */
  async getSpendReport(tenantId: string, now = new Date()): Promise<SpendReport> {
    const since = new Date(startOfUtcDay(now).getTime() - (DAILY_WINDOW_DAYS - 1) * DAY_MS);
    const [totals, lines, daily, costByProfile, statsByProfile, runs, unassignedUsd] = await Promise.all([
      this.getSpendTotals(tenantId, now),
      leadEngineRepository.spendLines(tenantId),
      leadEngineRepository.dailySpend(tenantId, since),
      leadEngineRepository.spendByProfile(tenantId),
      leadEngineRepository.runStatsByProfile(tenantId),
      leadEngineRepository.recentRuns(tenantId, RECENT_RUNS),
      leadEngineRepository.spendWithoutRun(tenantId),
    ]);

    const spendByDate = new Map(daily.map((d) => [d.date, d.costUsd]));
    const filledDaily: DailySpend[] = Array.from({ length: DAILY_WINDOW_DAYS }, (_, i) => {
      const date = new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      return { date, costUsd: spendByDate.get(date) ?? 0 };
    });

    const costMap = new Map(costByProfile.map((p) => [p.searchProfileId, p.costUsd]));
    const byProfile: SpendByProfile[] = statsByProfile
      .map((p) => ({ ...p, costUsd: costMap.get(p.searchProfileId) ?? 0 }))
      .sort((a, b) => b.costUsd - a.costUsd);
    // Manual leads and inbound email cost money but belong to no profile — show them as their own line so
    // this table adds up to the total.
    if (unassignedUsd > 0) {
      byProfile.push({ searchProfileId: "manual-and-email", searchProfileName: "Manual & email leads (no profile)", costUsd: unassignedUsd, runs: 0, leadsAdded: 0 });
      byProfile.sort((a, b) => b.costUsd - a.costUsd);
    }

    return { totals, lines, byProfile, daily: filledDaily, runs };
  },
};
