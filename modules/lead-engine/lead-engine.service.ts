import { getRunSteps, listLeadEngineRuns, type GithubRun } from "@/lib/github-actions";
import { searchProfilesService } from "@/modules/search-profiles/search-profiles.service";
import { leadEngineRepository } from "./lead-engine.repository";
import { featuredRun, parseRunTitle, type LiveRun, type LiveRunsResponse } from "./live-runs";
import type { DailySpend, SpendByProfile, SpendReport, SpendTotals, UsageEventInput } from "./lead-engine.types";

const DAILY_WINDOW_DAYS = 30;
const RECENT_RUNS = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toLiveRun(run: GithubRun): LiveRun {
  return {
    id: run.id,
    number: run.runNumber,
    title: run.title,
    scope: parseRunTitle(run.title, run.event),
    status: run.status,
    conclusion: run.conclusion,
    url: run.url,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    steps: [],
  };
}

/** Costs are estimates at list price — round only for display, keep full precision here. */
export const leadEngineService = {
  /**
   * The engine's recent GitHub Actions runs, for the live status on Search profiles. The workflow is shared by
   * every workspace, so a run started for another workspace's profile is left out; whole-engine runs (the
   * schedule) are shown to everyone. The steps are fetched only for the run being featured.
   */
  async getLiveRuns(tenantId: string, now: Date = new Date()): Promise<LiveRunsResponse> {
    const fetchedAt = now.toISOString();
    const listed = await listLeadEngineRuns(5);
    if (!listed.configured) return { configured: false, unavailable: false, runs: [], fetchedAt };
    if (!listed.ok) return { configured: true, unavailable: true, runs: [], fetchedAt };

    const ownProfiles = new Set((await searchProfilesService.listForTenant(tenantId)).map((p) => p.id.toLowerCase()));
    const runs = listed.data.map(toLiveRun).filter((run) => run.scope.kind !== "profile" || ownProfiles.has(run.scope.profileId));

    const focus = featuredRun(runs, now.getTime());
    if (focus) {
      const steps = await getRunSteps(focus.id);
      if (steps.configured && steps.ok) focus.steps = steps.data;
    }
    return { configured: true, unavailable: false, runs, fetchedAt };
  },

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
