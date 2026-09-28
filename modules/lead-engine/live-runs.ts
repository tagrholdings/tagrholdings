import { isDueAt, type ScheduleInput } from "@/modules/search-profiles/schedule";

/**
 * The lead engine runs as a GitHub Actions workflow (.github/workflows/lead-engine.yml). These are the pure
 * pieces of showing that run live in the CRM: the shape of a run, reading which profile a run is for from its
 * title, and deciding which profiles a given run is working on. The GitHub calls are in lib/github-actions.ts.
 */

export type LiveRunStatus = "queued" | "in_progress" | "completed";
export type LiveRunConclusion = "success" | "failure" | "cancelled" | "skipped" | null;

export interface LiveRunStep {
  name: string;
  status: LiveRunStatus;
  conclusion: LiveRunConclusion;
}

/** What a run is for. `all` = it works through every profile that is due (the schedule, or a hand-started run with no profile). */
export type RunScope = { kind: "profile"; profileId: string } | { kind: "signups" } | { kind: "all"; trigger: "scheduled" | "manual" };

export interface LiveRun {
  id: number;
  number: number;
  title: string;
  scope: RunScope;
  status: LiveRunStatus;
  conclusion: LiveRunConclusion;
  /** The run's page on github.com. */
  url: string;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  /** Only filled in for the run being shown in detail. */
  steps: LiveRunStep[];
}

export interface LiveRunsResponse {
  /** false when GITHUB_DISPATCH_TOKEN / GITHUB_REPOSITORY aren't set — the CRM then falls back to the schedule countdown. */
  configured: boolean;
  /** GitHub couldn't be reached this time (the last good answer stays on screen). */
  unavailable: boolean;
  runs: LiveRun[];
  fetchedAt: string;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Reads what a run is for from its title, which the workflow sets (`run-name`): "Lead engine · engine <profile id>",
 * "Lead engine · email-signups", "Lead engine · scheduled". Anything else — including runs from before the
 * workflow named itself — counts as a whole-engine run, which is the safe reading; for those, GitHub's own
 * `event` still says whether the schedule started it.
 */
export function parseRunTitle(title: string | null | undefined, event?: string): RunScope {
  const text = title ?? "";
  const profileId = text.match(UUID)?.[0];
  if (profileId) return { kind: "profile", profileId: profileId.toLowerCase() };
  if (/email-signups/.test(text)) return { kind: "signups" };
  if (/\bscheduled\b/.test(text) || event === "schedule") return { kind: "all", trigger: "scheduled" };
  return { kind: "all", trigger: "manual" };
}

export const isRunActive = (run: Pick<LiveRun, "status">) => run.status !== "completed";

/**
 * Is `run` working on this profile? A profile-specific run, yes. A whole-engine run works through the profiles
 * that were due when it started, so a profile that wasn't due isn't touched by it.
 */
export function runCoversProfile(run: LiveRun, profile: ScheduleInput & { id: string }): boolean {
  if (run.scope.kind === "profile") return run.scope.profileId === profile.id.toLowerCase();
  if (run.scope.kind === "all") return isDueAt(profile, new Date(run.createdAt).getTime());
  return false;
}

/** The active run (if any) that concerns this profile — the newest one when several are lined up. */
export function activeRunFor(runs: LiveRun[], profile: ScheduleInput & { id: string }): LiveRun | undefined {
  return runs.find((run) => isRunActive(run) && runCoversProfile(run, profile));
}

/** How long ago a finished run stays on screen as "just finished" before it quietly disappears. */
export const FINISHED_RUN_VISIBLE_MS = 10 * 60 * 1000;

/** The run to feature: the active one, else one that finished a moment ago. */
export function featuredRun(runs: LiveRun[], now: number): LiveRun | undefined {
  return runs.find(isRunActive) ?? runs.find((run) => now - new Date(run.updatedAt).getTime() < FINISHED_RUN_VISIBLE_MS);
}
