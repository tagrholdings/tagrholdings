"use client";

import { useState, useTransition } from "react";
import { CheckCheck, ChevronDown, Plus, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { OwnerBadge } from "@/components/traction/traction-ui";
import { markProcessReviewedAction } from "@/modules/traction/traction.actions";
import { PROCESS_AREAS, PROCESS_AREA_LABELS, PROCESS_STAGES, PROCESS_STAGE_LABELS, type ProcessRow, type TractionMember } from "@/modules/traction/traction.types";
import { formatDateUS } from "@/utils/date";
import { ProcessVault } from "./ProcessVault";

/** EOS updates core processes every quarter — one not looked at in this long gets flagged. */
const REVIEW_DAYS = 90;

const STAGE_STYLE = {
  documented: "bg-muted text-foreground",
  trained: "bg-accent/15 text-accent-text",
  followed: "bg-[color-mix(in_srgb,var(--slate)_16%,transparent)] text-green-800 dark:text-green-400",
} as const;

export function ProcessView({ processes, members }: { processes: ProcessRow[]; members: TractionMember[] }) {
  const [vault, setVault] = useState<{ open: boolean; process?: ProcessRow }>({ open: false });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now] = useState(() => Date.now());
  const missing = ["hr", "sales", "operations", "customer_service", "finance"].filter((area) => !processes.some((p) => p.area === area));

  function reviewed(process: ProcessRow) {
    startTransition(async () => {
      const result = await markProcessReviewedAction({ id: process.id });
      if (result?.serverError) notify.error(result.serverError);
      else notify.success(`“${process.name}” marked as reviewed.`);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted-foreground">
          Document the 20% of processes that give 80% of the consistency: 5–20 major steps each, then train on them until they&apos;re followed by all.
        </p>
        <Button data-tour="process-add" onClick={() => setVault({ open: true })}>
          <Plus />
          New process
        </Button>
      </div>

      {missing.length > 0 && processes.length > 0 && (
        <p className="rounded-lg border border-divider bg-surface px-4 py-3 text-sm text-muted-foreground">
          Core processes not documented yet: {missing.map((a) => PROCESS_AREA_LABELS[a as keyof typeof PROCESS_AREA_LABELS]).join(", ")}.
        </p>
      )}

      <div data-tour="process-list" className="flex flex-col gap-4 md:min-h-0 md:overflow-y-auto">
        {processes.length === 0 ? (
          <Empty className="border border-dashed border-divider">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Workflow />
              </EmptyMedia>
              <EmptyTitle>No core processes yet</EmptyTitle>
              <EmptyDescription>Start with the way a customer is won and served — HR, sales, operations, customer service and finance are the usual core processes.</EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setVault({ open: true })}>
              <Plus />
              New process
            </Button>
          </Empty>
        ) : (
          PROCESS_AREAS.filter((area) => processes.some((p) => p.area === area)).map((area) => (
            <section key={area} className="overflow-hidden rounded-lg border border-divider bg-surface">
              <p className="label-kicker border-b border-divider/50 bg-muted/30 px-4 py-2 text-muted-foreground">{PROCESS_AREA_LABELS[area]}</p>
              <ul>
                {processes
                  .filter((p) => p.area === area)
                  .map((process) => {
                    const stale = !process.lastReviewedAt || now - new Date(process.lastReviewedAt).getTime() > REVIEW_DAYS * 24 * 60 * 60 * 1000;
                    const isOpen = expanded === process.id;
                    return (
                      <li key={process.id} className="border-b border-divider/50 last:border-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                          <button type="button" onClick={() => setExpanded(isOpen ? null : process.id)} className="flex min-w-0 flex-1 basis-56 items-center gap-2 text-left" aria-expanded={isOpen}>
                            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
                            <span className="min-w-0">
                              <span className="block font-medium">{process.name}</span>
                              <span className={cn("block text-xs", stale ? "text-destructive" : "text-muted-foreground")}>
                                {process.steps.length} step{process.steps.length === 1 ? "" : "s"} ·{" "}
                                {process.lastReviewedAt ? `reviewed ${formatDateUS(process.lastReviewedAt, { month: "short", day: "numeric", year: "numeric" })}` : "never reviewed"}
                                {stale && " — due for its quarterly review"}
                              </span>
                            </span>
                          </button>
                          <OwnerBadge members={members} userId={process.ownerPersonId} />
                          <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", STAGE_STYLE[process.stage])}>{PROCESS_STAGE_LABELS[process.stage]}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => reviewed(process)}>
                              <CheckCheck />
                              Reviewed
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setVault({ open: true, process })}>
                              Edit
                            </Button>
                          </div>
                        </div>
                        {isOpen && (
                          <ol className="list-decimal space-y-1.5 border-t border-divider/50 bg-muted/20 py-3 pr-4 pl-12 text-sm">
                            {process.steps.map((step, i) => (
                              <li key={i}>
                                <span className="font-medium">{step.title}</span>
                                {step.detail && <span className="block text-muted-foreground">{step.detail}</span>}
                              </li>
                            ))}
                          </ol>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Stages: {PROCESS_STAGES.map((s) => PROCESS_STAGE_LABELS[s]).join(" → ")}. EOS calls the last one FBA — Followed By All.
      </p>

      <ProcessVault members={members} process={vault.process} open={vault.open} onOpenChange={(open) => setVault((v) => ({ ...v, open }))} />
    </>
  );
}
