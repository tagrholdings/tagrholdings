"use client";

import { CheckCircle2, Circle, Clock, ExternalLink, Loader2, MinusCircle, XCircle } from "lucide-react";
import { useNow } from "@/hooks/ui/use-now";
import { cn } from "@/lib/utils";
import { featuredRun, type LiveRun, type LiveRunStep } from "@/modules/lead-engine/live-runs";
import { formatCountdown } from "@/modules/search-profiles/schedule";

/** GitHub's own names for the steps, in the words this app uses. Anything not listed shows as GitHub names it. */
const STEP_LABELS: Record<string, string> = {
  "Set up job": "Start the runner",
  "Run actions/checkout@v4": "Get the code",
  "Run actions/setup-python@v5": "Set up Python",
  "Install dependencies": "Install the engine and browser",
  "Run the engine": "Search and score leads",
  "Attempt email-source signups": "Email-source signups",
};

/** The housekeeping steps GitHub adds at the end say nothing useful here. */
const isNoise = (step: LiveRunStep) => /^Post /.test(step.name) || step.name === "Complete job";

function StepIcon({ step }: { step: LiveRunStep }) {
  if (step.status === "in_progress") return <Loader2 className="size-4 animate-spin text-accent-text" aria-label="Running" />;
  if (step.status === "queued") return <Circle className="size-4 text-muted-foreground/50" aria-label="Waiting" />;
  if (step.conclusion === "success") return <CheckCircle2 className="size-4 text-green-800 dark:text-green-400" aria-label="Done" />;
  if (step.conclusion === "skipped") return <MinusCircle className="size-4 text-muted-foreground/60" aria-label="Skipped" />;
  return <XCircle className="size-4 text-destructive" aria-label="Failed" />;
}

function scopeLabel(run: LiveRun, profileName: string | null): string {
  switch (run.scope.kind) {
    case "profile":
      return `Run now · ${profileName ?? "search profile"}`;
    case "signups":
      return "Email-source signups";
    case "all":
      return run.scope.trigger === "scheduled" ? "Scheduled run" : "Manual run";
  }
}

/** Only ever link to github.com — the URL comes from an API response, so it's checked rather than trusted. */
const safeUrl = (url: string) => (url.startsWith("https://github.com/") ? url : null);

/**
 * One GitHub Actions run of the lead engine, live: what state it is in, how long it has been going, the steps
 * as GitHub lists them, and a link to the run on github.com. Same information as the run's page, without leaving the CRM.
 */
function RunCard({ run, profileName, now }: { run: LiveRun; profileName: string | null; now: number }) {
  const active = run.status !== "completed";
  const began = new Date(run.startedAt ?? run.createdAt).getTime();
  const ended = new Date(run.updatedAt).getTime();
  const steps = run.steps.filter((step) => !isNoise(step));
  const url = safeUrl(run.url);

  let heading: string;
  let detail: string;
  let icon: React.ReactNode;
  if (run.status === "queued") {
    heading = "Queued on GitHub";
    detail = `Waiting for a runner · ${formatCountdown(now - new Date(run.createdAt).getTime())}`;
    icon = <Clock className="size-5 text-muted-foreground" aria-hidden />;
  } else if (run.status === "in_progress") {
    heading = "Running on GitHub";
    detail = `Running for ${formatCountdown(now - began)}`;
    icon = <Loader2 className="size-5 animate-spin text-accent-text" aria-hidden />;
  } else if (run.conclusion === "success") {
    heading = "Finished";
    detail = `Took ${formatCountdown(ended - began)} · new leads are in the inbox`;
    icon = <CheckCircle2 className="size-5 text-green-800 dark:text-green-400" aria-hidden />;
  } else if (run.conclusion === "cancelled") {
    heading = "Cancelled";
    detail = "The run was stopped before it finished.";
    icon = <MinusCircle className="size-5 text-muted-foreground" aria-hidden />;
  } else {
    heading = "Failed";
    detail = "Something went wrong — open the run on GitHub to see why.";
    icon = <XCircle className="size-5 text-destructive" aria-hidden />;
  }

  const stepList = (
    <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
      {steps.map((step, index) => (
        <li key={`${index}-${step.name}`} className="flex items-center gap-2 text-sm">
          <StepIcon step={step} />
          <span className={cn("min-w-0 truncate", step.status === "queued" ? "text-muted-foreground" : "text-foreground")}>
            {STEP_LABELS[step.name] ?? step.name}
          </span>
        </li>
      ))}
    </ol>
  );

  return (
    <section
      aria-label="Lead engine run"
      aria-live="polite"
      className={cn("shrink-0 rounded-lg border bg-surface p-4", active ? "border-accent/50" : "border-divider")}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="label-kicker">{scopeLabel(run, profileName)}</p>
          <p className="font-serif text-base font-semibold text-foreground">{heading}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{detail}</p>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-text hover:text-accent-hover"
          >
            View on GitHub
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>

      {steps.length > 0 &&
        (active ? (
          stepList
        ) : (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show the steps</summary>
            {stepList}
          </details>
        ))}
    </section>
  );
}

/**
 * The run to show above the profile list, if there is one: the one in progress, or one that finished a few
 * minutes ago (so the outcome doesn't vanish the instant it ends). Renders nothing otherwise. It owns the
 * once-a-second clock so the rest of the page doesn't re-render every second.
 */
export function LiveRunSection({ runs, profileNames }: { runs: LiveRun[]; profileNames: Record<string, string> }) {
  const now = useNow();
  if (now === null) return null;
  const run = featuredRun(runs, now);
  if (!run) return null;
  return <RunCard run={run} profileName={run.scope.kind === "profile" ? (profileNames[run.scope.profileId] ?? null) : null} now={now} />;
}
