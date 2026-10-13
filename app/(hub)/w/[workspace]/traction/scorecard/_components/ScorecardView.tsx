"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LineChart, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OwnerBadge } from "@/components/traction/traction-ui";
import { RuleChecks } from "@/components/traction/rule-checks";
import { addStandardMeasurablesAction, createIssueAction, setEntryAction } from "@/modules/traction/traction.actions";
import {
  aggregate,
  formatGoal,
  formatValue,
  goalMet,
  periodLabel,
  periodStartFor,
  quarterLabel,
  quarterOf,
  quarterRange,
  shiftPeriod,
  WINDOW_SIZE,
  type Cadence,
  type RuleCheck,
} from "@/modules/traction/traction.logic";
import { AGGREGATION_LABELS, type EntryRow, type MeasurableRow, type TractionMember } from "@/modules/traction/traction.types";
import { MeasurableVault } from "./MeasurableVault";

type EntryPatch = { measurableId: string; periodStart: string; value: number | null };

function applyEntryPatch(entries: EntryRow[], patch: EntryPatch): EntryRow[] {
  const rest = entries.filter((e) => !(e.measurableId === patch.measurableId && e.periodStart === patch.periodStart));
  return patch.value === null ? rest : [...rest, { measurableId: patch.measurableId, periodStart: patch.periodStart, value: patch.value }];
}

export function ScorecardView({
  cadence,
  windowEnd,
  today,
  measurables,
  entries: initialEntries,
  periods,
  counts,
  members,
  checks,
  missingStandard,
}: {
  cadence: Cadence;
  windowEnd: string;
  today: string;
  measurables: MeasurableRow[];
  entries: EntryRow[];
  periods: string[];
  counts: Record<Cadence, number>;
  members: TractionMember[];
  checks: RuleCheck[];
  /** Names of the portfolio's standard measurables this company doesn't have yet. */
  missingStandard: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [entries, addPatch] = useOptimistic(initialEntries, applyEntryPatch);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [vault, setVault] = useState<{ open: boolean; measurable?: MeasurableRow }>({ open: false });

  const currentYear = Number(today.slice(0, 4));
  const currentPeriod = periodStartFor(today, cadence);
  const quarter = quarterOf(periods.at(-1)!);
  const { start: quarterStart, end: quarterEnd } = quarterRange(quarter);
  const valueOf = (measurableId: string, period: string) => entries.find((e) => e.measurableId === measurableId && e.periodStart === period)?.value ?? null;

  function navigate(next: { cadence?: Cadence; end?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.cadence) params.set("cadence", next.cadence);
    if (next.end === null) params.delete("end");
    else if (next.end) params.set("end", next.end);
    router.push(`${pathname}?${params.toString()}`);
  }

  function saveCell(measurable: MeasurableRow, period: string, raw: string) {
    setEditing(null);
    const trimmed = raw.replace(/[$,%\s]/g, "");
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && !Number.isFinite(value)) {
      notify.error("Type a number, like 14682.50.");
      return;
    }
    if (value === valueOf(measurable.id, period)) return;
    startTransition(async () => {
      addPatch({ measurableId: measurable.id, periodStart: period, value });
      const result = await setEntryAction({ measurableId: measurable.id, periodStart: period, value });
      if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't save that number.");
    });
  }

  function addStandard() {
    startTransition(async () => {
      const result = await addStandardMeasurablesAction({});
      if (result?.serverError) notify.error(result.serverError);
      else notify.success(`${result?.data?.added ?? 0} standard measurable(s) added. Give each one its owner.`);
    });
  }

  function dropToIssues(measurable: MeasurableRow, period: string) {
    startTransition(async () => {
      const value = formatValue(valueOf(measurable.id, period), measurable.unit);
      const result = await createIssueAction({
        title: `${measurable.name} off goal: ${value} in ${periodLabel(period, cadence, currentYear)}`,
        issueType: "problem",
        horizon: "short_term",
        ownerPersonId: measurable.ownerPersonId,
        measurableId: measurable.id,
      });
      if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't add the issue.");
      else notify.success("Dropped to Issues. The next L10 will see it.");
    });
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl<Cadence>
        tourId="scorecard-cadence"
        value={cadence}
        onChange={(c) => navigate({ cadence: c, end: null })}
        options={[
          { value: "weekly", label: `Weekly${counts.weekly ? ` · ${counts.weekly}` : ""}` },
          { value: "monthly", label: `Monthly${counts.monthly ? ` · ${counts.monthly}` : ""}` },
        ]}
      />
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label="Earlier" onClick={() => navigate({ end: shiftPeriod(periods[0], cadence, -1) })}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Later" disabled={windowEnd >= today} onClick={() => {
          const next = shiftPeriod(periods.at(-1)!, cadence, WINDOW_SIZE[cadence]);
          navigate({ end: next >= currentPeriod ? null : next });
        }}>
          <ChevronRight />
        </Button>
        {windowEnd < today && (
          <Button variant="ghost" size="sm" onClick={() => navigate({ end: null })}>
            Back to today
          </Button>
        )}
      </div>
      <div className="flex-1" />
      {missingStandard.length > 0 && (
        <Button data-tour="scorecard-standard" variant="outline" onClick={addStandard} title={`Adds: ${missingStandard.join(", ")}`}>
          Add {missingStandard.length} portfolio standard{missingStandard.length === 1 ? "" : "s"}
        </Button>
      )}
      <Button data-tour="scorecard-add" onClick={() => setVault({ open: true })}>
        <Plus />
        New measurable
      </Button>
    </div>
  );

  const measurableVault = <MeasurableVault members={members} defaultCadence={cadence} open={vault.open} measurable={vault.measurable} onOpenChange={(open) => setVault((v) => ({ ...v, open }))} />;

  if (measurables.length === 0) {
    return (
      <>
        {toolbar}
        <RuleChecks checks={checks} tourId="scorecard-checks" />
        <Empty data-tour="scorecard-grid" className="border border-dashed border-divider">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LineChart />
            </EmptyMedia>
            <EmptyTitle>No {cadence} measurables yet</EmptyTitle>
            <EmptyDescription>
              A measurable is one number with an owner and a goal: revenue, new customers, call backs. Enter it every {cadence === "weekly" ? "week" : "month"} and the cell turns green or red on its own.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setVault({ open: true })}>
            <Plus />
            New measurable
          </Button>
        </Empty>
        {measurableVault}
      </>
    );
  }

  return (
    <>
      {toolbar}
      <RuleChecks checks={checks} tourId="scorecard-checks" />
      <div data-tour="scorecard-grid" className="overflow-hidden rounded-lg border border-divider bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-divider">
                <th className="label-kicker sticky left-0 z-10 bg-surface px-4 py-3 text-left font-normal text-muted-foreground">Measurable</th>
                <th className="label-kicker px-3 py-3 text-left font-normal text-muted-foreground">Who</th>
                <th className="label-kicker px-3 py-3 text-left font-normal text-muted-foreground">Goal</th>
                {periods.map((p) => (
                  <th key={p} className={cn("label-kicker px-2 py-3 text-right font-normal whitespace-nowrap text-muted-foreground", p === currentPeriod && "text-accent-text")}>
                    {periodLabel(p, cadence, currentYear)}
                  </th>
                ))}
                <th className="label-kicker bg-accent/5 px-3 py-3 text-right font-normal whitespace-nowrap text-muted-foreground">{quarterLabel(quarter)}</th>
                <th className="label-kicker px-3 py-3 text-left font-normal text-muted-foreground">Trend</th>
              </tr>
            </thead>
            <tbody>
              {measurables.map((m) => {
                const quarterValues = entries
                  .filter((e) => e.measurableId === m.id && e.periodStart >= quarterStart && e.periodStart <= quarterEnd)
                  .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
                  .map((e) => e.value);
                const quarterTotal = aggregate(quarterValues, m.aggregation);
                const goal = formatGoal(m, m.unit);
                return (
                  <tr key={m.id} className="border-b border-divider/50 last:border-0">
                    <td className="sticky left-0 z-10 min-w-[180px] bg-surface px-4 py-2">
                      <button type="button" onClick={() => setVault({ open: true, measurable: m })} className="text-left font-medium text-foreground hover:text-accent-text">
                        {m.name}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <OwnerBadge members={members} userId={m.ownerPersonId} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                      {goal ?? (
                        <button type="button" onClick={() => setVault({ open: true, measurable: m })} className="rounded-sm border border-dashed border-divider px-2 py-0.5 text-xs italic hover:text-foreground">
                          Set goal
                        </button>
                      )}
                    </td>
                    {periods.map((p) => {
                      const key = `${m.id}:${p}`;
                      const value = valueOf(m.id, p);
                      const met = goalMet(m, value);
                      if (editing === key) {
                        return (
                          <td key={p} className="px-2 py-1.5 text-right">
                            <input
                              autoFocus
                              inputMode="decimal"
                              aria-label={`${m.name}, ${periodLabel(p, cadence, currentYear)}`}
                              defaultValue={value ?? ""}
                              onBlur={(e) => saveCell(m, p, e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditing(null);
                              }}
                              className="h-8 w-24 rounded-sm border border-accent bg-surface px-2 text-right text-sm tabular-nums outline-none"
                            />
                          </td>
                        );
                      }
                      const cellClass = cn(
                        "inline-flex h-8 min-w-[5.5rem] items-center justify-end rounded-sm border border-transparent px-2 tabular-nums transition-colors hover:border-divider",
                        value === null && "border-dashed border-divider text-muted-foreground",
                        met === true && "bg-[color-mix(in_srgb,var(--slate)_14%,transparent)] font-medium text-green-800 dark:text-green-400",
                        met === false && "bg-destructive/10 font-medium text-destructive"
                      );
                      const label = value === null ? "+" : formatValue(value, m.unit);
                      return (
                        <td key={p} className={cn("px-2 py-1.5 text-right", p === currentPeriod && "bg-accent/5")}>
                          {met === false ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className={cellClass} aria-label={`${m.name}, ${periodLabel(p, cadence, currentYear)}: ${label}, off goal`}>
                                  {label}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => dropToIssues(m, p)}>Drop to Issues</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setEditing(key)}>Edit number</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <button type="button" className={cellClass} onClick={() => setEditing(key)} aria-label={`${m.name}, ${periodLabel(p, cadence, currentYear)}: ${value === null ? "empty" : label}`}>
                              {label}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="bg-accent/5 px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      <span className="block font-medium">{quarterTotal === null ? "—" : formatValue(quarterTotal, m.unit)}</span>
                      <span className="block text-[11px] text-muted-foreground">{AGGREGATION_LABELS[m.aggregation].toLowerCase()}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Sparkline values={periods.map((p) => valueOf(m.id, p))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Click a cell to enter a number (empty it to clear). A red cell can be dropped to Issues. The {quarterLabel(quarter)} column rolls up every {cadence === "weekly" ? "week" : "month"} of the quarter.
      </p>
      {measurableVault}
    </>
  );
}

/** A small trend line: faint path, brass dot on the latest value. Gaps are skipped. */
function Sparkline({ values }: { values: (number | null)[] }) {
  const points = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (points.length < 2) return <span className="text-muted-foreground">—</span>;
  const W = 72;
  const H = 22;
  const P = 3;
  const ys = points.map(([, v]) => v);
  const min = Math.min(...ys);
  const span = Math.max(...ys) - min || 1;
  const x = (i: number) => P + (i / Math.max(values.length - 1, 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const d = points.map(([i, v], n) => `${n ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const [li, lv] = points[points.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="block">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-muted-foreground" />
      <circle cx={x(li)} cy={y(lv)} r={2.5} className="fill-accent" />
    </svg>
  );
}
