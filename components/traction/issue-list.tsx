"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, MoreHorizontal, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteIssueAction, dropIssueAction, reopenIssueAction, reorderIssuesAction } from "@/modules/traction/traction.actions";
import type { IssueRow, TractionMember } from "@/modules/traction/traction.types";
import { IssueVault, SolveIssueVault } from "./issue-vaults";
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

/**
 * One Issues List (short- or long-term): open issues ranked — the top 3 get a dark badge, the L10 works them first —
 * and, below, what was solved or dropped this week. Shared by the Issues page and the L10's IDS step.
 */
export function IssueList({ issues: initialIssues, members, horizon, showClosed = true, emptyText }: { issues: IssueRow[]; members: TractionMember[]; horizon: IssueRow["horizon"]; showClosed?: boolean; emptyText: string }) {
  const [issues, addPatch] = useOptimistic(initialIssues, applyPatch);
  const [, startTransition] = useTransition();
  const [solving, setSolving] = useState<IssueRow | null>(null);
  const [editing, setEditing] = useState<IssueRow | null>(null);

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
          {open.map((issue, index) => (
            <li key={issue.id} className="flex items-center gap-3 border-b border-divider/50 px-4 py-3 last:border-0">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  index < 3 ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
                aria-label={`Rank ${index + 1}`}
              >
                {index + 1}
              </span>
              <button type="button" onClick={() => setEditing(issue)} className="min-w-0 flex-1 text-left">
                <span className="block font-medium text-foreground hover:text-accent-text">{issue.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {issue.measurableName ? `From the Scorecard: ${issue.measurableName}` : issue.rockTitle ? `From a Rock: ${issue.rockTitle}` : issue.notes || "Added by hand"}
                </span>
              </button>
              <OwnerBadge members={members} userId={issue.ownerUserId} compact className="hidden sm:inline-flex" />
              <Button size="sm" onClick={() => setSolving(issue)}>
                Solve
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
                  <DropdownMenuItem onSelect={() => setEditing(issue)}>Edit</DropdownMenuItem>
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
          ))}
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
                  <span className="block truncate text-sm text-muted-foreground line-through">{issue.title}</span>
                  {issue.solution && <span className="block truncate text-xs text-muted-foreground">{issue.solution}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{issue.status === "solved" ? "Solved" : "Dropped"}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Reopen ${issue.title}`} onClick={() => run({ kind: "status", id: issue.id, status: "open" }, () => reopenIssueAction({ id: issue.id }))}>
                  <RotateCcw />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SolveIssueVault issue={solving} members={members} open={!!solving} onOpenChange={(o) => !o && setSolving(null)} />
      {editing && <IssueVault members={members} issue={editing} open onOpenChange={(o) => !o && setEditing(null)} />}
    </>
  );
}
