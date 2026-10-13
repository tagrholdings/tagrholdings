"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardCheck, Network, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { OwnerBadge } from "@/components/traction/traction-ui";
import { RuleChecks } from "@/components/traction/rule-checks";
import { deleteSeatAction } from "@/modules/traction/traction.actions";
import { quarterLabel, reviewVerdict, shiftQuarter, type RuleCheck } from "@/modules/traction/traction.logic";
import type { ReviewRow, SeatRow, TractionMember } from "@/modules/traction/traction.types";
import type { PersonRow } from "@/modules/team/team.types";
import { SeatVault } from "./SeatVault";
import { ReviewVault } from "./ReviewVault";

type Tab = "chart" | "analyzer";

interface Analyzer {
  me: PersonRow | null;
  coreValues: string[];
  people: PersonRow[];
  reviews: ReviewRow[];
  canManagerReview: string[];
  canSelfReview: string[];
}

export function PeopleView({
  initialTab,
  seats,
  members,
  isAdmin,
  quarter,
  analyzer,
  checks,
}: {
  initialTab: Tab;
  seats: SeatRow[];
  members: TractionMember[];
  isAdmin: boolean;
  quarter: string;
  analyzer: Analyzer;
  checks: RuleCheck[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <>
      <SegmentedControl<Tab>
        tourId="people-tabs"
        value={tab}
        onChange={setTab}
        className="self-start"
        options={[
          { value: "chart", label: "Accountability Chart", icon: Network },
          { value: "analyzer", label: "People Analyzer", icon: ClipboardCheck },
        ]}
      />
      {tab === "chart" ? <ChartView seats={seats} members={members} isAdmin={isAdmin} checks={checks} /> : <AnalyzerView quarter={quarter} analyzer={analyzer} seats={seats} members={members} />}
    </>
  );
}

// ───────────── Accountability Chart ─────────────

function ChartView({ seats, members, isAdmin, checks }: { seats: SeatRow[]; members: TractionMember[]; isAdmin: boolean; checks: RuleCheck[] }) {
  const [vault, setVault] = useState<{ open: boolean; seat?: SeatRow; parentSeatId?: string | null }>({ open: false });
  const [, startTransition] = useTransition();
  const roots = seats.filter((s) => !s.parentSeatId || !seats.some((p) => p.id === s.parentSeatId));
  const seated = new Set(seats.map((s) => s.personId).filter(Boolean));
  const withoutSeat = members.filter((m) => !seated.has(m.id));

  function remove(seat: SeatRow) {
    startTransition(async () => {
      const result = await deleteSeatAction({ id: seat.id });
      if (result?.serverError) notify.error(result.serverError);
      else notify.success(`“${seat.name}” removed. The seats under it moved up.`);
    });
  }

  const renderSeat = (seat: SeatRow, depth: number) => {
    const children = seats.filter((s) => s.parentSeatId === seat.id);
    return (
      <li key={seat.id} className="flex flex-col gap-2">
        <div className={cn("rounded-lg border bg-surface px-4 py-3", seat.personId ? "border-divider" : "border-dashed border-destructive/50")}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base font-semibold">{seat.name}</p>
              {seat.personId ? <OwnerBadge members={members} userId={seat.personId} /> : <p className="text-sm text-destructive">Empty seat</p>}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Add a seat under ${seat.name}`} onClick={() => setVault({ open: true, parentSeatId: seat.id })}>
                  <Plus />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${seat.name}`} onClick={() => setVault({ open: true, seat })}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${seat.name}`} onClick={() => remove(seat)}>
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
          {seat.responsibilities.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
              {seat.responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
        {children.length > 0 && <ul className={cn("flex flex-col gap-2 border-l border-divider pl-4", depth < 6 && "ml-4")}>{children.map((c) => renderSeat(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted-foreground">
          Seats and who sits in them — one person per seat. It decides who manages whom, so it also decides who reviews whom in the People Analyzer.
        </p>
        {isAdmin && (
          <Button data-tour="people-add-seat" onClick={() => setVault({ open: true, parentSeatId: null })}>
            <Plus />
            New seat
          </Button>
        )}
      </div>
      <RuleChecks checks={checks} />

      <div data-tour="people-chart">
        {seats.length === 0 ? (
          <Empty className="border border-dashed border-divider">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Network />
              </EmptyMedia>
              <EmptyTitle>No Accountability Chart yet</EmptyTitle>
              <EmptyDescription>Start with the Visionary and the Integrator, then a seat per major function (sales, operations, finance) with its 3–5 roles.</EmptyDescription>
            </EmptyHeader>
            {isAdmin && (
              <Button onClick={() => setVault({ open: true, parentSeatId: null })}>
                <Plus />
                New seat
              </Button>
            )}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">{roots.map((s) => renderSeat(s, 0))}</ul>
        )}
      </div>

      {withoutSeat.length > 0 && (
        <section className="rounded-lg border border-divider bg-surface px-4 py-3">
          <p className="label-kicker mb-2 text-muted-foreground">On the team without a seat · {withoutSeat.length}</p>
          <ul className="flex flex-wrap gap-3">
            {withoutSeat.map((m) => (
              <li key={m.id}>
                <OwnerBadge members={members} userId={m.id} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">That&apos;s allowed (someone new, or a role not mapped yet). Give them a seat when the chart reaches them.</p>
        </section>
      )}

      {isAdmin && <SeatVault seats={seats} members={members} seat={vault.seat} parentSeatId={vault.parentSeatId ?? null} open={vault.open} onOpenChange={(open) => setVault((v) => ({ ...v, open }))} />}
    </>
  );
}

// ───────────── People Analyzer ─────────────

const VERDICT_TEXT = { yes: "Yes", talk: "Talk", no: "No" } as const;

function Verdict({ label, value }: { label: string; value: "yes" | "talk" | "no" | null }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "rounded-pill px-2 py-px font-medium",
          value === "yes" && "bg-[color-mix(in_srgb,var(--slate)_16%,transparent)] text-green-800 dark:text-green-400",
          value === "talk" && "bg-accent/15 text-accent-text",
          value === "no" && "bg-destructive/10 text-destructive",
          value === null && "bg-muted text-muted-foreground"
        )}
      >
        {value ? VERDICT_TEXT[value] : "—"}
      </span>
    </span>
  );
}

function ReviewSummary({ review, coreValues, label }: { review: ReviewRow | undefined; coreValues: string[]; label: string }) {
  if (!review) return <span className="text-xs text-muted-foreground italic">{label}: not done</span>;
  const v = reviewVerdict(coreValues, review.valuesRatings, [review.getsIt, review.wantsIt, review.capacity]);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-xs font-medium">{label}</span>
      <Verdict label="Right person" value={v.rightPerson} />
      <Verdict label="Right seat" value={v.rightSeat} />
    </span>
  );
}

function AnalyzerView({ quarter, analyzer, seats, members }: { quarter: string; analyzer: Analyzer; seats: SeatRow[]; members: TractionMember[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [reviewing, setReviewing] = useState<{ person: PersonRow; kind: "manager" | "self" } | null>(null);
  const quarters = [-3, -2, -1, 0].map((n) => shiftQuarter(quarter, n));
  const seatOf = (personId: string) => seats.filter((s) => s.personId === personId).map((s) => s.name).join(", ");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {quarters.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => router.push(`${pathname}?tab=analyzer&quarter=${q}`)}
              className={cn(
                "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
                q === quarter ? "border-accent bg-accent text-ink" : "border-divider bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {quarterLabel(q)}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 basis-64 text-xs text-muted-foreground">
          Private. You see your own reviews and your direct reports&apos;; admins see everyone&apos;s. Manager and self reviews are compared in the Quarterly Conversation.
        </p>
      </div>

      {analyzer.coreValues.length === 0 && (
        <p className="rounded-lg border border-dashed border-divider px-4 py-3 text-sm text-muted-foreground">
          Write the core values in EOS → Vision first: &ldquo;right person&rdquo; is measured against them.
        </p>
      )}

      <div data-tour="people-analyzer" className="overflow-hidden rounded-lg border border-divider bg-surface">
        {analyzer.people.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nobody to review yet. Once you sit in a seat on the Accountability Chart, the people in the seats under yours show up here.
          </p>
        ) : (
          <ul>
            {analyzer.people.map((person) => {
              const manager = analyzer.reviews.find((r) => r.personId === person.id && r.kind === "manager");
              const self = analyzer.reviews.find((r) => r.personId === person.id && r.kind === "self");
              const canManager = analyzer.canManagerReview.includes(person.id);
              const canSelf = analyzer.canSelfReview.includes(person.id);
              return (
                <li key={person.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider/50 px-4 py-3 last:border-0">
                  <span className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                    <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {person.name}
                        {person.id === analyzer.me?.id && <span className="font-normal text-muted-foreground"> (you)</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{seatOf(person.id) || "No seat"}</span>
                    </span>
                  </span>
                  <div className="flex min-w-0 basis-72 flex-col gap-1">
                    <ReviewSummary review={manager} coreValues={analyzer.coreValues} label="Manager" />
                    <ReviewSummary review={self} coreValues={analyzer.coreValues} label="Self" />
                  </div>
                  <div className="flex gap-2">
                    {canManager && (
                      <Button variant="outline" size="sm" onClick={() => setReviewing({ person, kind: "manager" })}>
                        {manager ? "Edit review" : "Review"}
                      </Button>
                    )}
                    {canSelf && (
                      <Button variant="outline" size="sm" onClick={() => setReviewing({ person, kind: "self" })}>
                        {self ? "Edit self review" : "Self review"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ReviewVault
        person={reviewing?.person ?? null}
        kind={reviewing?.kind ?? "manager"}
        quarter={quarter}
        coreValues={analyzer.coreValues}
        existing={reviewing ? analyzer.reviews.find((r) => r.personId === reviewing.person.id && r.kind === reviewing.kind) : undefined}
        members={members}
        open={!!reviewing}
        onOpenChange={(o) => !o && setReviewing(null)}
      />
    </>
  );
}
