"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CheckSquare, ChevronLeft, ChevronRight, LayoutGrid, Link2, List, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { dueBucket, formatDateUS, getCurrentWeekDays, type DueBucket } from "@/utils/date";
import { useIsMobile } from "@/hooks/ui/use-device";
import { notify } from "@/components/ui/toaster";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { CreateActivityVault } from "@/components/shared/create-activity-vault";
import { ActivityDetailPanel } from "@/components/shared/activity-detail-panel";
import { ACTIVITY_TYPE_ICONS, buildOptimisticActivity, type ActivityLookups } from "@/components/shared/activity-form";
import { createActivityAction, setActivityDoneAction, updateActivityDateAction } from "@/modules/activities/activities.actions";
import type { ActivityRow, NewActivity } from "@/modules/activities/activities.types";
import { WeekBoard, type WeekDateField } from "./WeekBoard";

type View = "board" | "list";

const FILTERS: { id: DueBucket | "all" | "open" | "done"; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this_week", label: "Next 7 days" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

// Three mutation kinds (add, done-toggle, date move) against one list —
// design.md's documented exception to useOptimisticAction.
type Patch =
  | { kind: "add"; activity: ActivityRow }
  | { kind: "done"; id: string; done: boolean }
  | { kind: "date"; id: string; field: WeekDateField; date: Date };

function applyPatch(state: ActivityRow[], patch: Patch): ActivityRow[] {
  switch (patch.kind) {
    case "add":
      return [...state, patch.activity];
    case "done":
      return state.map((a) => (a.id === patch.id ? { ...a, done: patch.done } : a));
    case "date":
      return state.map((a) => (a.id === patch.id ? { ...a, [patch.field]: patch.date } : a));
  }
}

function matchesFilter(activity: ActivityRow, filter: (typeof FILTERS)[number]["id"]) {
  if (filter === "all") return true;
  if (filter === "done") return activity.done;
  if (filter === "open") return !activity.done;
  if (activity.done) return false;
  const bucket = dueBucket(activity.dueDate);
  // "Next 7 days" includes today and tomorrow — it's a window, not a disjoint bucket.
  if (filter === "this_week") return bucket === "today" || bucket === "tomorrow" || bucket === "this_week";
  return bucket === filter;
}

/**
 * Every activity in one place — tasks created here, inside a lead
 * (/leads-inbox) or inside a project item (/pipeline) are all the same
 * `activities` rows. Board = this week's days as columns (drag to
 * reschedule); List = everything, filterable.
 */
export function ActivitiesView({
  activities: initialActivities,
  lookups,
  initialSelectedId,
}: {
  activities: ActivityRow[];
  lookups: ActivityLookups;
  initialSelectedId: string | null;
}) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<View | null>(null);
  // Until the user picks one, the default follows the device: List on
  // mobile, Board elsewhere (no effect needed — just derived).
  const resolvedView: View = view ?? (isMobile ? "list" : "board");

  const [dateField, setDateField] = useState<WeekDateField>("dueDate");
  const [weekOffset, setWeekOffset] = useState(0);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  const [optimisticActivities, addPatch] = useOptimistic(initialActivities, applyPatch);
  const [, startTransition] = useTransition();

  function handleSetDone(id: string, done: boolean) {
    startTransition(async () => {
      addPatch({ kind: "done", id, done });
      const result = await setActivityDoneAction({ id, done });
      if (result?.serverError) notify.error(result.serverError);
    });
  }

  function handleMoveToDay(id: string, date: Date) {
    startTransition(async () => {
      addPatch({ kind: "date", id, field: dateField, date });
      const result = await updateActivityDateAction({ id, field: dateField, date });
      if (result?.serverError) notify.error(result.serverError);
    });
  }

  /** Resolves/rejects with the action so CreateActivityVault's button shows success/error. */
  function handleCreate(input: NewActivity) {
    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        addPatch({ kind: "add", activity: buildOptimisticActivity(input, lookups) });
        const result = await createActivityAction(input);
        if (result?.serverError || result?.validationErrors) {
          notify.error(result.serverError ?? "Couldn't create that activity. Please try again.");
          reject(new Error("createActivityAction failed"));
          return;
        }
        resolve();
      });
    });
  }

  const memberById = new Map(lookups.members.map((m) => [m.id, m.name ?? m.email]));
  function assigneeLabel(activity: ActivityRow) {
    if (activity.assignedToContactName) return activity.assignedToContactName;
    if (activity.assignedToUserId) return memberById.get(activity.assignedToUserId) ?? null;
    return null;
  }

  const query = search.trim().toLowerCase();
  const searched = query
    ? optimisticActivities.filter(
        (a) =>
          a.subject.toLowerCase().includes(query) ||
          a.contactName?.toLowerCase().includes(query) ||
          a.organizationName?.toLowerCase().includes(query) ||
          a.pipelineItemTitle?.toLowerCase().includes(query)
      )
    : optimisticActivities;
  const listed = searched
    .filter((a) => matchesFilter(a, filter))
    // Open first, then soonest due; undated last.
    .sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    });

  const days = getCurrentWeekDays(new Date(), weekOffset);
  const weekLabel =
    weekOffset === 0
      ? "This week"
      : `${formatDateUS(days[0].date, { month: "short", day: "numeric" })} – ${formatDateUS(days[6].date, { month: "short", day: "numeric" })}`;

  const selected = optimisticActivities.find((a) => a.id === selectedId) ?? null;

  return (
    // See components/shared/side-panel.tsx — this row is what lets opening
    // an activity's detail panel push/shrink the content instead of overlaying it.
    <div className="flex min-w-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Filter by title, contact, lead or project"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            containerClassName="w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs"
          />

          {resolvedView === "board" && (
            <>
              <div className="flex items-center gap-1 rounded-pill border border-divider bg-surface px-1">
                <button
                  type="button"
                  aria-label="Previous week"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="min-w-24 px-1 text-xs font-medium text-foreground"
                  title="Back to this week"
                >
                  {weekLabel}
                </button>
                <button
                  type="button"
                  aria-label="Next week"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <SegmentedControl
                value={dateField}
                onChange={setDateField}
                options={[
                  { value: "dueDate", label: "Due date" },
                  { value: "createdAt", label: "Created date" },
                ]}
              />
            </>
          )}

          <SegmentedControl
            value={resolvedView}
            onChange={setView}
            options={[
              { value: "board", ariaLabel: "Board view", icon: LayoutGrid },
              { value: "list", ariaLabel: "List view", icon: List },
            ]}
          />

          <CreateActivityVault
            contacts={lookups.contacts}
            organizations={lookups.organizations}
            pipelineItems={lookups.pipelineItems}
            members={lookups.members}
            onCreate={handleCreate}
          />
        </div>

        {optimisticActivities.length === 0 ? (
          <Empty className="border border-dashed border-divider">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecks />
              </EmptyMedia>
              <EmptyTitle>Nothing on the books</EmptyTitle>
              <EmptyDescription>
                Calls, meetings and tasks — created here or inside a lead or project — show up on this page.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : resolvedView === "board" ? (
          <WeekBoard days={days} activities={searched} dateField={dateField} onSelect={setSelectedId} onMoveToDay={handleMoveToDay} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
                    filter === f.id
                      ? "border-accent bg-accent text-ink"
                      : "border-divider bg-surface text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                  <span className="ml-1.5 opacity-70">{searched.filter((a) => matchesFilter(a, f.id)).length}</span>
                </button>
              ))}
            </div>

            {listed.length === 0 ? (
              <Empty>
                <EmptyTitle className="text-sm">Nothing in this filter</EmptyTitle>
              </Empty>
            ) : (
              <ul className="divide-y divide-divider rounded-lg border border-divider bg-surface">
                {listed.map((activity) => {
                  const Icon = ACTIVITY_TYPE_ICONS[activity.type] ?? CheckSquare;
                  const overdue = !activity.done && dueBucket(activity.dueDate) === "overdue";
                  const isOptimistic = activity.id.startsWith("optimistic-");
                  const assignee = assigneeLabel(activity);
                  const context = [activity.contactName, activity.organizationName, assignee && `Assigned to ${assignee}`]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={activity.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-accent/5",
                        isOptimistic && "pointer-events-none opacity-60"
                      )}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={activity.done}
                        onClick={() => handleSetDone(activity.id, !activity.done)}
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                          activity.done ? "border-accent bg-accent text-ink" : "border-divider bg-background"
                        )}
                      >
                        {activity.done && <CheckSquare className="size-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedId(activity.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />

                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate font-medium", activity.done ? "text-muted-foreground line-through" : "text-foreground")}>
                            {activity.subject}
                          </p>
                          {(activity.pipelineItemTitle || context) && (
                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                              {activity.pipelineItemTitle && (
                                <>
                                  <Link2 className="size-3 shrink-0" />
                                  <span className="truncate">{activity.pipelineItemTitle}</span>
                                  {context && <span>·</span>}
                                </>
                              )}
                              <span className="truncate">{context}</span>
                            </p>
                          )}
                        </div>

                        {activity.priority && !activity.done && (
                          <span
                            className={cn(
                              "hidden shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase sm:inline",
                              activity.priority === "high" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {activity.priority}
                          </span>
                        )}

                        <span className={cn("label-kicker shrink-0", overdue ? "text-destructive" : "text-muted-foreground")}>
                          {activity.dueDate ? formatDateUS(activity.dueDate, { month: "short", day: "numeric" }) : "No date"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      <ActivityDetailPanel
        activity={selected}
        members={lookups.members}
        pipelineItems={lookups.pipelineItems}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onSetDone={handleSetDone}
      />
    </div>
  );
}
