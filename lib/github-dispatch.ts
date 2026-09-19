import "server-only";

/**
 * Optionally asks GitHub Actions to start the lead-engine workflow NOW (workflow_dispatch), so a
 * "Run now" / "Attempt subscribe" click doesn't wait for the next scheduled tick.
 *
 * This is deliberately a courtesy on top of the database contract, never a replacement for it: the
 * request is always recorded in Postgres first (run_requested_at / attempt_requested_at), and the job
 * picks it up on whichever run happens next. If GitHub isn't configured or the call fails, nothing is
 * lost — the request just waits for the scheduled run. The app still never talks to the scraper.
 *
 * Env (all optional; without the first two this is a no-op):
 *   GITHUB_DISPATCH_TOKEN   fine-grained token, repository permission "Actions: read and write"
 *   GITHUB_REPOSITORY       "owner/repo"
 *   GITHUB_DISPATCH_REF     branch to run the workflow from (default "main")
 */

export type DispatchOutcome = "dispatched" | "not_configured" | "failed";

const WORKFLOW_FILE = "lead-engine.yml";

export async function dispatchLeadEngineWorkflow(inputs: { task: "engine" | "email-signups"; profile_id?: string }): Promise<DispatchOutcome> {
  const token = process.env.GITHUB_DISPATCH_TOKEN?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  if (!token || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return "not_configured";

  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: process.env.GITHUB_DISPATCH_REF?.trim() || "main", inputs }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 204) return "dispatched";
    console.error(`GitHub workflow dispatch answered ${response.status}`);
    return "failed";
  } catch (error) {
    console.error("GitHub workflow dispatch failed:", error instanceof Error ? error.message : error);
    return "failed";
  }
}
