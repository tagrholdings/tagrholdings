"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CircleAlert, Gem, LayoutGrid, List, Plus } from "lucide-react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { ActivityProgressBadge } from "@/components/pipeline/ActivityProgressBadge";
import type { ActivityProgress } from "@/components/pipeline/types";
import { RocksBoard } from "./RocksBoard";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { OwnerBadge, RockBar, RockStatusMenu } from "@/components/traction/traction-ui";
import { RuleChecks } from "@/components/traction/rule-checks";
import { closeOutRockAction, createIssueAction, setRockStatusAction } from "@/modules/traction/traction.actions";
import { memberName, percent, planningQuarters, quarterLabel, shiftQuarter, type RuleCheck } from "@/modules/traction/traction.logic";
import type { RockActivity, RockRow, RockStatus, TractionMember } from "@/modules/traction/traction.types";
import { formatDateUS } from "@/utils/date";
import { RockVault } from "./RockVault";

type Goal = { id: string; text: string };

export function RocksView({
  rocks: initialRocks,
  quarter,
  currentQuarter,
  members,
  goals,
  checks,
  todos,
}: {
  rocks: RockRow[];
  quarter: string;
  currentQuarter: string;
  members: TractionMember[];
  goals: Goal[];
  checks: RuleCheck[];
  /** Every Rock's milestones / to-dos (activities linked to it). */
  todos: RockActivity[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [rocks, setStatus] = useOptimistic(initialRocks, (state, patch: { id: string; status: RockStatus }) => state.map((r) => (r.id === patch.id ? { ...r, status: patch.status } : r)));
  const [, startTransition] = useTransition();
  const [vault, setVault] = useState<{ open: boolean; rock?: RockRow }>({ open: false });
  const [view, setView] = useState<"list" | "board">("list");
  const progressByRock: Record<string, ActivityProgress> = {};
  for (const todo of todos) {
    const p = (progressByRock[todo.rockId] ??= { done: 0, total: 0 });
    p.total++;
    if (todo.done) p.done++;
  }

  const quarters = planningQuarters(currentQuarter, [...rocks.map((r) => r.quarter), quarter]);
  const visible = rocks.filter((r) => r.quarter === quarter);
  const finished = quarter < currentQuarter;
  // EOS scores Rocks binary: complete, or not (rolled over and dropped count as not done).
  const rate = visible.length ? percent(visible.filter((r) => r.status === "complete").length, visible.length) : null;
  const live = visible.filter((r) => r.status !== "dropped" && r.status !== "rolled_over");
  const count = (s: RockStatus) => live.filter((r) => r.status === s).length;
  const company = visible.filter((r) => r.isCompany);
  const individual = visible.filter((r) => !r.isCompany);
  const byOwner = [...new Set(individual.map((r) => r.ownerPersonId ?? ""))].map((owner) => ({ owner, rocks: individual.filter((r) => (r.ownerPersonId ?? "") === owner) }));

  function changeStatus(rock: RockRow, status: Exclude<RockStatus, "rolled_over">) {
    startTransition(async () => {
      setStatus({ id: rock.id, status });
      const result = await setRockStatusAction({ id: rock.id, status });
      if (result?.serverError) notify.error(result.serverError);
      else if (status === "off_track") notify.info("Off track. Drop it to Issues so the L10 can solve it.");
    });
  }

  function closeOut(rock: RockRow, action: "complete" | "carry" | "drop") {
    startTransition(async () => {
      setStatus({ id: rock.id, status: action === "complete" ? "complete" : action === "drop" ? "dropped" : "rolled_over" });
      const result = await closeOutRockAction({ id: rock.id, action });
      if (result?.serverError) notify.error(result.serverError);
      else if (action === "carry") notify.success(`Carried into ${quarterLabel(shiftQuarter(rock.quarter, 1))}.`);
    });
  }

  function dropToIssues(rock: RockRow) {
    startTransition(async () => {
      const result = await createIssueAction({ title: `Rock off track: ${rock.title}`, issueType: "problem", horizon: "short_term", ownerPersonId: rock.ownerPersonId, rockId: rock.id });
      if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't add the issue.");
      else notify.success("Dropped to Issues.");
    });
  }

  const row = (rock: RockRow) => {
    const goal = goals.find((g) => g.id === rock.oneYearGoalId);
    const open = rock.status === "on_track" || rock.status === "off_track";
    return (
      <li key={rock.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider/50 px-4 py-3 last:border-0">
        <button type="button" onClick={() => setVault({ open: true, rock })} className="min-w-0 flex-1 basis-56 text-left" disabled={rock.status === "rolled_over"}>
          <span className={cn("block font-medium text-foreground hover:text-accent-text", (rock.status === "dropped" || rock.status === "rolled_over") && "text-muted-foreground line-through")}>{rock.title}</span>
          <span className="block text-xs text-muted-foreground">{rock.successCriteria ? `Done when: ${rock.successCriteria}` : "No finish line written yet"}</span>
          {goal && <span className="block text-xs text-accent-text">Moves: {goal.text}</span>}
        </button>
        <OwnerBadge members={members} userId={rock.ownerPersonId} className="w-32" />
        <span className="w-12">
          <ActivityProgressBadge progress={progressByRock[rock.id]} />
        </span>
        <span className="w-24 text-xs text-muted-foreground tabular-nums">{rock.dueDate ? `Due ${formatDateUS(new Date(`${rock.dueDate}T12:00:00`), { month: "short", day: "numeric" })}` : "No due date"}</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {finished && open ? (
            // Quarter is over: EOS doesn't do partial credit — finish it, carry it, or drop it.
            <>
              <Button variant="outline" size="sm" onClick={() => closeOut(rock, "complete")}>
                Complete
              </Button>
              <Button variant="outline" size="sm" onClick={() => closeOut(rock, "carry")}>
                Carry to {quarterLabel(shiftQuarter(rock.quarter, 1))}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => closeOut(rock, "drop")}>
                Drop
              </Button>
            </>
          ) : (
            <>
              {rock.status === "off_track" && (
                <Button variant="ghost" size="sm" onClick={() => dropToIssues(rock)}>
                  <CircleAlert />
                  Drop to Issues
                </Button>
              )}
              <RockStatusMenu status={rock.status} onChange={(status) => changeStatus(rock, status)} />
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div data-tour="rocks-quarters" className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5">
          {quarters.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => router.push(`${pathname}?quarter=${q}`)}
              className={cn(
                "shrink-0 rounded-pill border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                q === quarter ? "border-accent bg-accent text-ink" : "border-divider bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {quarterLabel(q)}
              {q === currentQuarter && <span className="ml-1 opacity-70">· now</span>}
            </button>
          ))}
        </div>
        <SegmentedControl
          tourId="rocks-view"
          value={view}
          onChange={setView}
          options={[
            { value: "list", ariaLabel: "List view", icon: List },
            { value: "board", ariaLabel: "Board view", icon: LayoutGrid },
          ]}
        />
        <Button data-tour="rocks-add" onClick={() => setVault({ open: true })}>
          <Plus />
          New Rock
        </Button>
      </div>

      <RuleChecks checks={checks} />

      <div data-tour="rocks-list" className="overflow-hidden rounded-lg border border-divider bg-surface">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-divider px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="label-kicker text-muted-foreground">{quarterLabel(quarter)}</p>
            <p className="text-sm text-muted-foreground">
              {visible.length === 0 ? "No Rocks yet. EOS recommends 3 to 7 company Rocks per quarter." : `${count("complete")} complete · ${count("on_track")} on track · ${count("off_track")} off track`}
            </p>
          </div>
          {rate !== null && (
            <div data-tour="rocks-rate" className="text-right">
              <p className={cn("font-serif text-xl font-semibold tabular-nums", finished && (rate >= 80 ? "text-green-800 dark:text-green-400" : "text-destructive"))}>{rate}%</p>
              <p className="text-xs text-muted-foreground">{finished ? "finished · target 80%" : "complete so far · target 80%"}</p>
            </div>
          )}
          {live.length > 0 && (
            <div className="w-full sm:w-48">
              <RockBar complete={count("complete")} onTrack={count("on_track")} offTrack={count("off_track")} total={live.length} />
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Gem />
              </EmptyMedia>
              <EmptyTitle>No Rocks for {quarterLabel(quarter)}</EmptyTitle>
              <EmptyDescription>A Rock is a 90-day priority with one owner and a clear finish line.</EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setVault({ open: true })}>
              <Plus />
              New Rock
            </Button>
          </Empty>
        ) : view === "board" ? (
          <div className="p-3">
            {finished && <p className="mb-3 text-xs text-muted-foreground">This quarter is over: close out its open Rocks from the list view (complete, carry or drop).</p>}
            <RocksBoard
              rocks={visible}
              members={members}
              progressByRock={progressByRock}
              readOnly={finished}
              onSelect={(rock) => rock.status !== "rolled_over" && setVault({ open: true, rock })}
              onMove={changeStatus}
            />
          </div>
        ) : (
          <>
            <p className="label-kicker border-b border-divider/50 bg-muted/30 px-4 py-2 text-muted-foreground">Company Rocks · {company.length}</p>
            {company.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No company Rocks this quarter.</p> : <ul>{company.map(row)}</ul>}
            {byOwner.map(({ owner, rocks: own }) => (
              <div key={owner || "none"}>
                <p className="label-kicker border-y border-divider/50 bg-muted/30 px-4 py-2 text-muted-foreground">
                  {memberName(members, owner) ?? "No owner"}&apos;s Rocks · {own.length}
                </p>
                <ul>{own.map(row)}</ul>
              </div>
            ))}
          </>
        )}
      </div>

      <RockVault
        members={members}
        goals={goals}
        rock={vault.rock}
        todos={vault.rock ? todos.filter((t) => t.rockId === vault.rock!.id) : []}
        defaultQuarter={quarter}
        currentQuarter={currentQuarter}
        open={vault.open}
        onOpenChange={(open) => setVault((v) => ({ ...v, open }))}
      />
    </>
  );
}
