"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CircleAlert, Gem, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { OwnerBadge, RockBar, RockStatusMenu } from "@/components/traction/traction-ui";
import { createIssueAction, setRockStatusAction } from "@/modules/traction/traction.actions";
import { quarterLabel, shiftQuarter } from "@/modules/traction/traction.logic";
import type { RockRow, RockStatus, TractionMember } from "@/modules/traction/traction.types";
import { formatDateUS } from "@/utils/date";
import { RockVault } from "./RockVault";

export function RocksView({ rocks: initialRocks, quarter, currentQuarter, members }: { rocks: RockRow[]; quarter: string; currentQuarter: string; members: TractionMember[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [rocks, setStatus] = useOptimistic(initialRocks, (state, patch: { id: string; status: RockStatus }) => state.map((r) => (r.id === patch.id ? { ...r, status: patch.status } : r)));
  const [, startTransition] = useTransition();
  const [vault, setVault] = useState<{ open: boolean; rock?: RockRow }>({ open: false });

  // Every quarter that has Rocks, plus this one and the next (where new Rocks usually go), newest first.
  const quarters = [...new Set([...rocks.map((r) => r.quarter), currentQuarter, shiftQuarter(currentQuarter, 1), quarter])].sort().reverse();
  const visible = rocks.filter((r) => r.quarter === quarter);
  const counted = visible.filter((r) => r.status !== "dropped");
  const count = (s: RockStatus) => counted.filter((r) => r.status === s).length;

  function changeStatus(rock: RockRow, status: RockStatus) {
    startTransition(async () => {
      setStatus({ id: rock.id, status });
      const result = await setRockStatusAction({ id: rock.id, status });
      if (result?.serverError) notify.error(result.serverError);
      else if (status === "off_track") notify.info("Off track. Drop it to Issues so the L10 can solve it.");
    });
  }

  function dropToIssues(rock: RockRow) {
    startTransition(async () => {
      const result = await createIssueAction({ title: `Rock off track: ${rock.title}`, horizon: "short_term", ownerUserId: rock.ownerUserId, rockId: rock.id });
      if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't add the issue.");
      else notify.success("Dropped to Issues.");
    });
  }

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
        <Button data-tour="rocks-add" onClick={() => setVault({ open: true })}>
          <Plus />
          New Rock
        </Button>
      </div>

      <div data-tour="rocks-list" className="overflow-hidden rounded-lg border border-divider bg-surface">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-divider px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="label-kicker text-muted-foreground">{quarterLabel(quarter)}</p>
            <p className="text-sm text-muted-foreground">
              {counted.length === 0 ? "No Rocks yet. EOS recommends 3 to 7 per quarter." : `${count("complete")} complete · ${count("on_track")} on track · ${count("off_track")} off track`}
            </p>
          </div>
          {counted.length > 0 && (
            <div className="w-full sm:w-48">
              <RockBar complete={count("complete")} onTrack={count("on_track")} offTrack={count("off_track")} total={counted.length} />
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
        ) : (
          <ul>
            {visible.map((rock) => (
              <li key={rock.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider/50 px-4 py-3 last:border-0">
                <button type="button" onClick={() => setVault({ open: true, rock })} className="min-w-0 flex-1 basis-56 text-left">
                  <span className={cn("block font-medium text-foreground hover:text-accent-text", rock.status === "dropped" && "text-muted-foreground line-through")}>{rock.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {rock.successCriteria ? `Done when: ${rock.successCriteria}` : "No finish line written yet"}
                  </span>
                </button>
                <OwnerBadge members={members} userId={rock.ownerUserId} className="w-28" />
                <span className="w-24 text-xs text-muted-foreground tabular-nums">{rock.dueDate ? `Due ${formatDateUS(new Date(`${rock.dueDate}T12:00:00`), { month: "short", day: "numeric" })}` : "No due date"}</span>
                <div className="ml-auto flex items-center gap-2">
                  {rock.status === "off_track" && (
                    <Button variant="ghost" size="sm" onClick={() => dropToIssues(rock)}>
                      <CircleAlert />
                      Drop to Issues
                    </Button>
                  )}
                  <RockStatusMenu status={rock.status} onChange={(status) => changeStatus(rock, status)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RockVault members={members} rock={vault.rock} defaultQuarter={quarter} open={vault.open} onOpenChange={(open) => setVault((v) => ({ ...v, open }))} />
    </>
  );
}
