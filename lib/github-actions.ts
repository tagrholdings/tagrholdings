import "server-only";

/**
 * Read-only view of the lead-engine workflow's runs on GitHub, for the CRM's live status (Search profiles).
 * Same optional env as lib/github-dispatch.ts: GITHUB_DISPATCH_TOKEN (its "Actions" permission covers reading
 * runs) and GITHUB_REPOSITORY. Without them `configured` is false and nothing is called.
 *
 * Answers are cached for a few seconds and shared by everyone: several open tabs polling every few seconds
 * must not multiply into GitHub API calls (5,000/hour per token).
 */

export type GithubRunStatus = "queued" | "in_progress" | "completed";

export interface GithubRun {
  id: number;
  runNumber: number;
  title: string;
  event: string;
  status: GithubRunStatus;
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
  url: string;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
}

export interface GithubStep {
  name: string;
  status: GithubRunStatus;
  conclusion: GithubRun["conclusion"];
}

export type GithubResult<T> = { configured: false } | { configured: true; ok: false } | { configured: true; ok: true; data: T };

const WORKFLOW_FILE = "lead-engine.yml";
const CACHE_MS = 4_000;
const cache = new Map<string, { at: number; value: unknown }>();

function config() {
  const token = process.env.GITHUB_DISPATCH_TOKEN?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  if (!token || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return null;
  return { token, repository };
}

/** GitHub's finer-grained states (waiting, requested, pending…) all mean "not started yet". */
const toStatus = (status: string | null | undefined): GithubRunStatus =>
  status === "completed" ? "completed" : status === "in_progress" ? "in_progress" : "queued";

const toConclusion = (value: string | null | undefined): GithubRun["conclusion"] =>
  value === "success" || value === "failure" || value === "cancelled" || value === "skipped" ? value : value ? "failure" : null;

async function get<T>(path: string, parse: (json: unknown) => T): Promise<GithubResult<T>> {
  const cfg = config();
  if (!cfg) return { configured: false };

  const key = `${cfg.repository}${path}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { configured: true, ok: true, data: hit.value as T };

  try {
    const response = await fetch(`https://api.github.com/repos/${cfg.repository}${path}`, {
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error(`GitHub API ${path} answered ${response.status}`);
      return { configured: true, ok: false };
    }
    const value = parse(await response.json());
    cache.set(key, { at: Date.now(), value });
    return { configured: true, ok: true, data: value };
  } catch (error) {
    console.error("GitHub API call failed:", error instanceof Error ? error.message : error);
    return { configured: true, ok: false };
  }
}

type Json = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");

/** The newest runs of the lead-engine workflow, newest first. */
export function listLeadEngineRuns(limit = 5) {
  return get(`/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${limit}`, (json): GithubRun[] =>
    ((json as Json).workflow_runs as Json[] | undefined ?? []).map((run) => ({
      id: Number(run.id),
      runNumber: Number(run.run_number),
      title: str(run.display_title) || str(run.name),
      event: str(run.event),
      status: toStatus(str(run.status)),
      conclusion: toConclusion(str(run.conclusion) || null),
      url: str(run.html_url),
      createdAt: str(run.created_at),
      startedAt: str(run.run_started_at) || null,
      updatedAt: str(run.updated_at),
    }))
  );
}

/** The steps of a run's first job — the list you see expanded on the run's page. */
export function getRunSteps(runId: number) {
  return get(`/actions/runs/${runId}/jobs`, (json): GithubStep[] => {
    const job = ((json as Json).jobs as Json[] | undefined)?.[0];
    return ((job?.steps as Json[] | undefined) ?? []).map((step) => ({
      name: str(step.name),
      status: toStatus(str(step.status)),
      conclusion: toConclusion(str(step.conclusion) || null),
    }));
  });
}
