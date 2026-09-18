"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckSquare, Plus, ArrowUpRight } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { cn } from "@/lib/utils";
import { dueBucket, formatDateUS } from "@/utils/date";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_TYPE_ICONS,
  ActivityFormFields,
  activityFormDefaults,
  activityFormSchema,
  buildOptimisticActivity,
  toNewActivity,
  type ActivityFormValues,
  type ActivityLookups,
} from "@/components/shared/activity-form";
import { createActivityAction, setActivityDoneAction } from "@/modules/activities/activities.actions";
import type { ActivityRow, NewActivity } from "@/modules/activities/activities.types";
import { ActivityProgressBadge } from "./ActivityProgressBadge";

type Patch = { kind: "add"; activity: ActivityRow } | { kind: "done"; id: string; done: boolean };

function applyPatch(state: ActivityRow[], patch: Patch): ActivityRow[] {
  if (patch.kind === "add") return [...state, patch.activity];
  return state.map((a) => (a.id === patch.id ? { ...a, done: patch.done } : a));
}

function ActivityRowItem({ activity, onToggle }: { activity: ActivityRow; onToggle: (id: string, done: boolean) => void }) {
  const Icon = ACTIVITY_TYPE_ICONS[activity.type] ?? CheckSquare;
  const isOptimistic = activity.id.startsWith("optimistic-");
  const overdue = !activity.done && dueBucket(activity.dueDate) === "overdue";

  return (
    <div className={cn("flex items-center gap-2.5 py-2", isOptimistic && "opacity-60")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={activity.done}
        disabled={isOptimistic}
        onClick={() => onToggle(activity.id, !activity.done)}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          activity.done ? "border-accent bg-accent text-ink" : "border-divider"
        )}
      >
        {activity.done && <CheckSquare className="size-2.5" />}
      </button>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <Link
        href={isOptimistic ? "#" : `/activities?activity=${activity.id}`}
        className={cn(
          "min-w-0 flex-1 truncate text-sm hover:underline",
          activity.done ? "text-muted-foreground line-through" : "text-foreground"
        )}
      >
        {activity.subject}
      </Link>
      {activity.priority === "high" && !activity.done && (
        <span className="shrink-0 text-[10px] font-semibold uppercase text-destructive">High</span>
      )}
      <span className={cn("shrink-0 text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
        {activity.dueDate ? formatDateUS(activity.dueDate, { month: "short", day: "numeric" }) : "No date"}
      </span>
    </div>
  );
}

function AddActivityForm({
  defaults,
  lookups,
  onSubmit,
  onCancel,
}: {
  defaults: Partial<ActivityFormValues>;
  lookups: ActivityLookups;
  onSubmit: (input: NewActivity) => void;
  onCancel?: () => void;
}) {
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: activityFormDefaults(defaults),
  });

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        onSubmit(toNewActivity(values));
        form.reset(activityFormDefaults(defaults));
      })}
      className="space-y-4 rounded-lg border border-divider bg-background p-4"
    >
      <ActivityFormFields form={form} lookups={lookups} showPipelineItem={false} collapsibleExtras />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm">
          Add activity
        </Button>
      </div>
    </form>
  );
}

/**
 * A lead's / project item's activities. Everything added here is a regular
 * `activities` row linked via `pipelineItemId` — so it also shows up on
 * /activities ("This week") and on the linked contact's panel.
 */
export function PipelineItemActivities({
  pipelineItemId,
  contactId,
  organizationId,
  activities,
  lookups,
}: {
  pipelineItemId: string;
  contactId: string | null;
  organizationId: string | null;
  activities: ActivityRow[];
  lookups: ActivityLookups;
}) {
  const isMobile = useIsMobile();
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Two mutation kinds (add, done-toggle) against one list — design.md's
  // documented exception to useOptimisticAction.
  const [optimisticActivities, addPatch] = useOptimistic(activities, applyPatch);
  const [, startTransition] = useTransition();

  const defaults: Partial<ActivityFormValues> = {
    pipelineItemId,
    contactId: contactId ?? undefined,
    organizationId: organizationId ?? undefined,
  };

  function handleToggle(id: string, done: boolean) {
    startTransition(async () => {
      addPatch({ kind: "done", id, done });
      const result = await setActivityDoneAction({ id, done });
      if (result?.serverError) notify.error(result.serverError);
    });
  }

  function handleAdd(input: NewActivity) {
    const withLink = { ...input, pipelineItemId };
    startTransition(async () => {
      addPatch({ kind: "add", activity: buildOptimisticActivity(withLink, lookups) });
      const result = await createActivityAction(withLink);
      if (result?.serverError || result?.validationErrors) {
        notify.error(result.serverError ?? "Couldn't add that activity. Please try again.");
      } else {
        notify.success("Activity added — it's also on the Activities page.");
      }
    });
    setShowInlineForm(false);
    setSheetOpen(false);
  }

  const sorted = [...optimisticActivities].sort((a, b) => Number(a.done) - Number(b.done));
  const done = optimisticActivities.filter((a) => a.done).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-base font-semibold text-foreground">Activities</h3>
          <ActivityProgressBadge progress={{ done, total: optimisticActivities.length }} />
        </div>
        <button
          type="button"
          onClick={() => (isMobile ? setSheetOpen(true) : setShowInlineForm((v) => !v))}
          className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
        >
          <Plus className="size-3.5" />
          Add activity
        </button>
      </div>

      {!isMobile && showInlineForm && (
        <div className="mt-3">
          <AddActivityForm defaults={defaults} lookups={lookups} onSubmit={handleAdd} onCancel={() => setShowInlineForm(false)} />
        </div>
      )}

      <div className="mt-2 divide-y divide-divider">
        {sorted.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No activities yet.</p>
        ) : (
          sorted.map((activity) => <ActivityRowItem key={activity.id} activity={activity} onToggle={handleToggle} />)
        )}
      </div>

      {optimisticActivities.length > 0 && (
        <Link
          href="/activities"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          See all on Activities
          <ArrowUpRight className="size-3" />
        </Link>
      )}

      {/* Drawer.NestedRoot, not another Vault (plain Drawer.Root) — vaul's
          documented pattern for a sheet opened from inside an already-open
          sheet (see design.md's "Relational pickers" section). */}
      {isMobile && (
        <Drawer.NestedRoot open={sheetOpen} onOpenChange={setSheetOpen}>
          <Drawer.Portal container={typeof document !== "undefined" ? document.getElementById("vault-root") : null}>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm" />
            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[90vh] flex-col rounded-t-lg border border-divider bg-surface p-4 pb-6 outline-none">
              <div className="mx-auto mb-4 h-1.5 w-14 shrink-0 rounded-full bg-divider" />
              <Drawer.Title className="mb-3 font-serif text-lg font-semibold text-foreground">Add activity</Drawer.Title>
              <div className="no-scrollbar overflow-y-auto">
                <AddActivityForm defaults={defaults} lookups={lookups} onSubmit={handleAdd} />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.NestedRoot>
      )}
    </div>
  );
}
