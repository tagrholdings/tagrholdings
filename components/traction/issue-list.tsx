"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, MoreHorizontal, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteIssueAction, dropIssueAction, reopenIssueAction, reorderIssuesAction } from "@/modules/traction/traction.actions";
import { ISSUE_TYPE_LABELS, type IssueOutcome, type IssueRow, type IssueType, type TractionMember } from "@/modules/traction/traction.types";
import { IssueVault, ResolveIssueVault } from "./issue-vaults";
import { OwnerBadge } from "./traction-ui";

type Patch = { kind: "order"; ids: string[] } | { kind: "status"; id: string; status: IssueRow["status"] } | { kind: "remove"; id: string };

function applyPatch(state: IssueRow[], patch: Patch): IssueRow[] {
  if (patch.kind === "remove") return state.filter((i) => i.id !== patch.id);
  if (patch.kind === "status") return state.map((i) => (i.id === patch.id ? { ...i, status: patch.status, rank: null } : i));
  const rank = new Map(patch.ids.map((id, index) => [id, index + 1]));
  return state.map((i) => (rank.has(i.id) ? { ...i, rank: rank.get(i.id)! } : i));
}

function byRank(a: IssueRow, b: IssueRow) {
  if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
  if (a.rank !== null) return -1;
  if (b.rank !== null) return 1;
  return String(a.createdAt).localeCompare(String(b.createdAt));
}

const RESOLVE_LABEL: Record<IssueType, string> = { problem: "Solve", idea: "Decide", obstacle: "Remove" };
const TYPE_STYLE: Record<IssueType, string> = {
  problem: "bg-destructive/10 text-destructive",
  idea: "bg-accent/15 text-accent-text",
  obstacle: "bg-muted text-foreground",
};
const OUTCOME_TEXT: Record<IssueOutcome, string> = { solved: "Solved", yes: "Yes", no: "No", later: "Later", removed: "Removed", escalated: "Escalated" };

/** Whole weeks an issue has been open. EOS: the same issue coming back week after week means IDS isn't finishing it. */
function weeksOpen(createdAt: Date | string, now: number) {
  return Math.floor((now - new Date(createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/** The 5-15 minutes IDS gives one issue: counts up, and turns red past 15. */
const DISCUSS_LIMIT_SECONDS = 15 * 60;

/**
 * One Issues List (short- or long-term): open issues ranked — the top 3 get a dark badge, the L10 works them first —
 * and, below, what was closed this week. Shared by the Issues page and the L10's IDS step (`withTimer` adds the
 * per-issue discussion timer there).
 */
export function IssueList({
  issues: initialIssues,
  members,
  horizon,
  showClosed = true,
  withTimer = false,
  emptyText,
}: {
  issues: IssueRow[];
  members: TractionMember[];
  horizon: IssueRow["horizon"];
  showClosed?: boolean;
  withTimer?: boolean;
  emptyText: string;
}) {
  const [issues, addPatch] = useOptimistic(initialIssues, applyPatch);
  const [, startTransition] = useTransition();
  const [resolving, setResolving] = useState<IssueRow | null>(null);
  const [editing, setEditing] = useState<IssueRow | null>(null);
  const [discussing, setDiscussing] = useState<{ id: string; seconds: number } | null>(null);
  const [now] = useState(() => Date.now());

  // The clock restarts only when another issue is picked, not on every tick.
  const discussingId = discussing?.id;
  useEffect(() => {
    if (!discussingId) return;
    const timer = setInterval(() => setDiscussing((d) => (d ? { ...d, seconds: d.seconds + 1 } : d)), 1000);
    return () => clearInterval(timer);
  }, [discussingId]);

  const open = issues.filter((i) => i.horizon === horizon && i.status === "open").sort(byRank);
  const closed = issues.filter((i) => i.horizon === horizon && i.status !== "open");

  function run(patch: Patch, action: () => Promise<{ serverError?: string } | undefined>, success?: string) {
    startTransition(async () => {
      addPatch(patch);
      const result = await action();
      if (result?.serverError) notify.error(result.serverError);
      else if (success) notify.success(success);
    });
  }

  function move(index: number, by: -1 | 1) {
    const ids = open.map((i) => i.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run({ kind: "order", ids }, () => reorderIssuesAction({ ids }));
  }

  return (
    <>
      {open.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ol>
          {open.map((issue, index) => {
            const weeks = weeksOpen(issue.createdAt, now);
            const isDiscussing = discussing?.id === issue.id;
            const seconds = isDiscussing ? discussing.seconds : 0;
            return (
              <li key={issue.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-divider/50 px-4 py-3 last:border-0", isDiscussing && "bg-accent/10")}>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    index < 3 ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}
                  aria-label={`Rank ${index + 1}`}
                >
                  {index + 1}
                </span>
                <button type="button" onClick={() => setEditing(issue)} className="min-w-0 flex-1 basis-48 text-left">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-pill px-2 py-px text-[11px] font-medium", TYPE_STYLE[issue.issueType])}>{ISSUE_TYPE_LABELS[issue.issueType]}</span>
                    {weeks >= 1 && (
                      <span className={cn("text-[11px] tabular-nums", weeks >= 4 ? "font-medium text-destructive" : "text-muted-foreground")}>
                        open {weeks} wk{weeks === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                  <span className="block font-medium text-foreground hover:text-accent-text">{issue.rootCause || issue.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {issue.rootCause ? issue.title : issue.measurableName ? `From the Scorecard: ${issue.measurableName}` : issue.rockTitle ? `From a Rock: ${issue.rockTitle}` : "No root cause written yet"}
                  </span>
                </button>
                <OwnerBadge members={members} userId={issue.ownerPersonId} compact className="hidden sm:inline-flex" />
                {withTimer && (
                  <Button
                    variant={isDiscussing ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => setDiscussing(isDiscussing ? null : { id: issue.id, seconds: 0 })}
                    aria-label={isDiscussing ? "Stop the discussion timer" : `Discuss ${issue.title}`}
                  >
                    <Timer />
                    <span className={cn("tabular-nums", seconds > DISCUSS_LIMIT_SECONDS && "text-destructive")}>
                      {isDiscussing ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "Discuss"}
                    </span>
                  </Button>
                )}
                <Button size="sm" onClick={() => setResolving(issue)}>
                  {RESOLVE_LABEL[issue.issueType]}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`More for ${issue.title}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, -1)}>
                      <ArrowUp className="size-4" /> Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === open.length - 1} onSelect={() => move(index, 1)}>
                      <ArrowDown className="size-4" /> Move down
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setEditing(issue)}>Edit (kind, root cause)</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => run({ kind: "status", id: issue.id, status: "dropped" }, () => dropIssueAction({ id: issue.id }), "Issue dropped.")}>
                      Drop (not worth solving)
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => run({ kind: "remove", id: issue.id }, () => deleteIssueAction({ id: issue.id }), "Issue deleted.")}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ol>
      )}

      {showClosed && closed.length > 0 && (
        <div className="border-t border-divider">
          <p className="label-kicker px-4 pt-3 pb-1 text-muted-foreground">Closed this week</p>
          <ul>
            {closed.map((issue) => (
              <li key={issue.id} className="flex items-center gap-3 px-4 py-2">
                <CheckCircle2 className={cn("size-4 shrink-0", issue.status === "solved" ? "text-accent-text" : "text-muted-foreground")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-muted-foreground line-through">{issue.rootCause || issue.title}</span>
                  {issue.solution && <span className="block truncate text-xs text-muted-foreground">{issue.solution}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{issue.outcome ? OUTCOME_TEXT[issue.outcome] : issue.status === "solved" ? "Solved" : "Dropped"}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Reopen ${issue.title}`} onClick={() => run({ kind: "status", id: issue.id, status: "open" }, () => reopenIssueAction({ id: issue.id }))}>
                  <RotateCcw />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ResolveIssueVault issue={resolving} members={members} open={!!resolving} onOpenChange={(o) => !o && setResolving(null)} />
      {editing && <IssueVault members={members} issue={editing} open onOpenChange={(o) => !o && setEditing(null)} />}
    </>
  );
}
