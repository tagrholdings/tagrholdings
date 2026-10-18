"use client";

import { useState, useSyncExternalStore } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Phone, Users, CheckSquare, Mail, Repeat, ChevronDown, Bell } from "lucide-react";
import { VaultField, VaultInput } from "@/components/ui/vault";
import type { PipelineItemSummary } from "@/components/pipeline/types";
import { CommandSelect } from "@/components/shared/command-select";
import { DatePicker } from "@/components/shared/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { browserTimeZone, formatDueTime, hasTimeComponent, parseLocalDateTime, toDateInputValue, toTimeInputValue, toZonedInputValues } from "@/utils/date";
import { quarterLabel, zonedTimeToUtc } from "@/modules/traction/traction.logic";
import { TimeZoneSelect } from "@/components/shared/timezone-select";
import {
  ACTIVITY_TYPES,
  ACTIVITY_PRIORITIES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_PRIORITY_LABELS,
  type ActivityRow,
  type NewActivity,
} from "@/modules/activities/activities.types";

/** When a reminder fires if the activity has a due date but no time ("HH:mm", the viewer's local time). */
export const DEFAULT_REMINDER_TIME = "09:00";

const noopSubscribe = () => () => {};

/** The browser's notification permission, or null while rendering on the server (so hydration never mismatches). */
function useNotificationPermission(): NotificationPermission | "unsupported" | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => null
  );
}

export const ACTIVITY_TYPE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  meeting: Users,
  task: CheckSquare,
  email: Mail,
  follow_up: Repeat,
};

const TITLE_PLACEHOLDERS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  call: "Call with Jane about renewal",
  meeting: "Kickoff meeting",
  task: "Send updated proposal",
  email: "Follow up on quote",
  follow_up: "Check in after demo",
};

export const activityFormSchema = z.object({
  subject: z.string().trim().min(1, "Title is required."),
  type: z.enum(ACTIVITY_TYPES),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  /** IANA zone `dueTime` is read in. Defaults to the browser's; only saved when a time is set. */
  timezone: z.string().optional(),
  /** "" = cleared (react-hook-form puts a field set to undefined back to its default, so clearing uses ""). */
  priority: z.enum(ACTIVITY_PRIORITIES).or(z.literal("")).optional(),
  notes: z.string().optional(),
  // Pickers clear to "", not undefined: react-hook-form puts a field set to undefined back to its default value, so
  // clearing a prefilled one (the card's contact, say) used to snap right back. "" is read as "none" everywhere below.
  /** "person:<id>" (a team person) or "contact:<id>" — one picker over two different owner kinds. */
  assignedTo: z.string().optional(),
  contactId: z.string().optional(),
  organizationId: z.string().optional(),
  pipelineItemId: z.string().optional(),
  rockId: z.string().optional(),
  /** "Enable notification" — a push reminder at the due time (DEFAULT_REMINDER_TIME when no time is set). Needs a due date. */
  notify: z.boolean().optional(),
});

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

/** Due date defaults to today so a new activity lands on /activities' "This week" board right away. */
export function activityFormDefaults(overrides: Partial<ActivityFormValues> = {}): ActivityFormValues {
  return {
    subject: "",
    type: "task",
    dueDate: toDateInputValue(new Date()),
    dueTime: "",
    timezone: browserTimeZone(),
    priority: undefined,
    notes: "",
    assignedTo: undefined,
    contactId: undefined,
    organizationId: undefined,
    pipelineItemId: undefined,
    rockId: undefined,
    notify: false,
    ...overrides,
  };
}

/** An existing activity's values, for the edit form. A due time shows only when one was actually set (not local midnight). */
export function activityToFormValues(activity: ActivityRow): ActivityFormValues {
  const due = activity.dueDate ? new Date(activity.dueDate) : null;
  const type = (ACTIVITY_TYPES as readonly string[]).includes(activity.type) ? (activity.type as (typeof ACTIVITY_TYPES)[number]) : "task";
  const priority = (ACTIVITY_PRIORITIES as readonly string[]).includes(activity.priority ?? "")
    ? (activity.priority as (typeof ACTIVITY_PRIORITIES)[number])
    : undefined;
  return {
    subject: activity.subject,
    type,
    // An activity entered in another zone is edited in that zone, so the time you see is the time that was typed.
    dueDate: due ? (activity.timezone ? toZonedInputValues(due, activity.timezone).date : toDateInputValue(due)) : "",
    dueTime: due ? (activity.timezone ? toZonedInputValues(due, activity.timezone).time : hasTimeComponent(due) ? toTimeInputValue(due) : "") : "",
    timezone: activity.timezone ?? browserTimeZone(),
    priority,
    notes: activity.notes ?? "",
    assignedTo: activity.assignedToPersonId
      ? `person:${activity.assignedToPersonId}`
      : activity.assignedToContactId
        ? `contact:${activity.assignedToContactId}`
        : undefined,
    contactId: activity.contactId ?? undefined,
    organizationId: activity.organizationId ?? undefined,
    pipelineItemId: activity.pipelineItemId ?? undefined,
    rockId: activity.rockId ?? undefined,
    notify: activity.notify,
  };
}

/** The instant the form's date + time + zone describe. No time → local midnight (or the default reminder hour). */
function dueInstant(values: ActivityFormValues): Date {
  const { dueDate, dueTime, timezone } = values;
  if (!dueDate) throw new Error("dueInstant needs a date");
  if (!dueTime) return parseLocalDateTime(dueDate, values.notify ? DEFAULT_REMINDER_TIME : undefined);
  if (!timezone || timezone === browserTimeZone()) return parseLocalDateTime(dueDate, dueTime);
  const [year, month, day] = dueDate.split("-").map(Number);
  const [hour, minute] = dueTime.split(":").map(Number);
  return zonedTimeToUtc(year, month, day, hour, minute, timezone);
}

export function toNewActivity(values: ActivityFormValues): NewActivity {
  const [assignedKind, assignedId] = values.assignedTo?.split(":") ?? [];
  return {
    subject: values.subject.trim(),
    type: values.type,
    // A reminder needs an exact moment: with "Enable notification" on but no time picked, it goes off at the default hour.
    dueDate: values.dueDate ? dueInstant(values) : undefined,
    // The zone only means something next to a time; the default reminder hour is the viewer's own.
    timezone: values.dueDate && values.dueTime ? values.timezone || undefined : undefined,
    priority: values.priority || undefined,
    notes: values.notes?.trim() || undefined,
    contactId: values.contactId || undefined,
    organizationId: values.organizationId || undefined,
    pipelineItemId: values.pipelineItemId || undefined,
    rockId: values.rockId || undefined,
    assignedToPersonId: assignedKind === "person" ? assignedId : undefined,
    assignedToContactId: assignedKind === "contact" ? assignedId : undefined,
    notify: values.notify && values.dueDate ? true : undefined,
  };
}

export interface ActivityLookups {
  contacts: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
  members: { id: string; name: string | null; email: string }[];
  pipelineItems: PipelineItemSummary[];
  /** Rocks an activity can move forward. The "Linked Rock" picker shows only when a page passes them. */
  rocks?: { id: string; title: string; quarter: string }[];
}

/** The row an optimistic "add" shows until the server's revalidated list replaces it. */
export function buildOptimisticActivity(input: NewActivity, lookups: ActivityLookups): ActivityRow {
  const nameOf = (list: { id: string; name: string }[], id?: string | null) => list.find((x) => x.id === id)?.name ?? null;
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    type: input.type,
    subject: input.subject,
    dueDate: input.dueDate ?? null,
    timezone: input.timezone ?? null,
    createdAt: new Date(),
    done: false,
    priority: input.priority ?? null,
    notes: input.notes ?? null,
    contactId: input.contactId ?? null,
    contactName: nameOf(lookups.contacts, input.contactId),
    organizationId: input.organizationId ?? null,
    organizationName: nameOf(lookups.organizations, input.organizationId),
    pipelineItemId: input.pipelineItemId ?? null,
    pipelineItemTitle: lookups.pipelineItems.find((i) => i.id === input.pipelineItemId)?.title ?? null,
    rockId: input.rockId ?? null,
    rockTitle: lookups.rocks?.find((r) => r.id === input.rockId)?.title ?? null,
    assignedToPersonId: input.assignedToPersonId ?? null,
    assignedToContactId: input.assignedToContactId ?? null,
    assignedToContactName: nameOf(lookups.contacts, input.assignedToContactId),
    notify: input.notify ?? false,
    l10Todo: false,
  };
}

function PillGroup<T extends string>({
  value,
  onChange,
  options,
  allowNone,
}: {
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: { value: T; label: string; icon?: typeof Phone }[];
  /** Clicking the active pill again clears it (optional fields like priority). */
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active && allowNone ? undefined : option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-accent bg-accent text-ink"
                : "border-divider bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface ActivityFormFieldsProps {
  form: UseFormReturn<ActivityFormValues>;
  lookups: ActivityLookups;
  /** Hidden when the activity is created from inside a pipeline item — the link is implied. */
  showPipelineItem?: boolean;
  /** Hidden when the activity is created from inside a Rock — the link is implied. */
  showRock?: boolean;
  /** Compact mode (inline in a detail panel): the secondary fields sit behind a "More options" toggle. */
  collapsibleExtras?: boolean;
}

/**
 * Every activity field, shared by `CreateActivityVault` and the inline "Add
 * activity" form inside a lead/project's detail panel — so both always offer
 * the same options. Pickers are `CommandSelect` (inline, never a nested
 * Drawer) and the small enums are pill groups for the same reason — see
 * design.md's "Relational pickers" section.
 */
export function ActivityFormFields({ form, lookups, showPipelineItem = true, showRock = true, collapsibleExtras = false }: ActivityFormFieldsProps) {
  const { register, control, watch, formState: { errors } } = form;
  const [showExtras, setShowExtras] = useState(!collapsibleExtras);
  const selectedType = watch("type");
  const [dueDate, dueTime, notifyChecked, timezone] = watch(["dueDate", "dueTime", "notify", "timezone"]);
  const otherZone = !!dueDate && !!dueTime && !!timezone && timezone !== browserTimeZone();
  const canNotify = !!dueDate;
  const permission = useNotificationPermission();

  return (
    <div className="space-y-4">
      <VaultField label="Title" required error={errors.subject?.message}>
        <VaultInput placeholder={TITLE_PLACEHOLDERS[selectedType]} {...register("subject")} />
      </VaultField>

      <VaultField label="Type" required>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <PillGroup
              value={field.value}
              onChange={(v) => v && field.onChange(v)}
              options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t], icon: ACTIVITY_TYPE_ICONS[t] }))}
            />
          )}
        />
      </VaultField>

      <div className="grid grid-cols-2 gap-3">
        <VaultField label="Due date">
          <Controller control={control} name="dueDate" render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />} />
        </VaultField>
        <VaultField label="Time (optional)">
          <VaultInput type="time" {...register("dueTime")} />
        </VaultField>
      </div>

      {dueTime && (
        <VaultField label="Time zone">
          <Controller control={control} name="timezone" render={({ field }) => <TimeZoneSelect value={field.value} onChange={field.onChange} />} />
          {otherZone && (
            <p className="text-xs text-muted-foreground">
              That&apos;s {formatDueTime(dueInstant({ ...form.getValues(), dueDate, dueTime, timezone }), timezone)} — shown in your time first.
            </p>
          )}
        </VaultField>
      )}

      <label className={cn("flex items-start gap-3 text-sm", canNotify ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
        <input type="checkbox" disabled={!canNotify} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" {...register("notify")} />
        <span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Bell className="size-3.5" aria-hidden />
            Enable notification
          </span>
          <span className="block text-xs text-muted-foreground">
            {!canNotify
              ? "Set a due date to get a reminder."
              : notifyChecked && permission !== null && permission !== "granted"
                ? "Push is off on this device — turn it on in Settings → Notifications to receive it."
                : dueTime
                  ? "Get a push notification with a sound when it's due."
                  : "Get a push notification at 9:00 AM — or pick a time above."}
          </span>
        </span>
      </label>

      <VaultField label="Priority">
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <PillGroup
              allowNone
              value={field.value}
              onChange={(v) => field.onChange(v ?? "")}
              options={ACTIVITY_PRIORITIES.map((p) => ({ value: p, label: ACTIVITY_PRIORITY_LABELS[p] }))}
            />
          )}
        />
      </VaultField>

      {collapsibleExtras && (
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", showExtras && "rotate-180")} />
          {showExtras ? "Fewer options" : "More options (notes, assignee, links)"}
        </button>
      )}

      {showExtras && (
        <>
          <VaultField label="Notes">
            <Textarea placeholder="Add any context…" {...register("notes")} />
          </VaultField>

          {(lookups.members.length > 0 || lookups.contacts.length > 0) && (
            <VaultField label="Assigned to">
              <Controller
                control={control}
                name="assignedTo"
                render={({ field }) => (
                  <CommandSelect
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="Unassigned"
                    searchPlaceholder="Search team or contacts…"
                    groups={[
                      { label: "Team", options: lookups.members.map((m) => ({ value: `person:${m.id}`, label: m.name ?? m.email })) },
                      { label: "Contacts", options: lookups.contacts.map((c) => ({ value: `contact:${c.id}`, label: c.name })) },
                    ]}
                  />
                )}
              />
            </VaultField>
          )}

          {showPipelineItem && (
            <VaultField label="Linked lead or project">
              <Controller
                control={control}
                name="pipelineItemId"
                render={({ field }) => (
                  <CommandSelect
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="None"
                    searchPlaceholder="Search leads and projects…"
                    options={lookups.pipelineItems.map((item) => ({
                      value: item.id,
                      label: item.title,
                      description: item.boardIsSystem ? "Lead" : item.boardName,
                    }))}
                  />
                )}
              />
            </VaultField>
          )}

          {showRock && lookups.rocks && lookups.rocks.length > 0 && (
            <VaultField label="Linked Rock">
              <Controller
                control={control}
                name="rockId"
                render={({ field }) => (
                  <CommandSelect
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="None"
                    searchPlaceholder="Search Rocks…"
                    options={lookups.rocks!.map((rock) => ({ value: rock.id, label: rock.title, description: quarterLabel(rock.quarter) }))}
                  />
                )}
              />
            </VaultField>
          )}

          <VaultField label="Linked person">
            <Controller
              control={control}
              name="contactId"
              render={({ field }) => (
                <CommandSelect
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "")}
                  placeholder="None"
                  searchPlaceholder="Search contacts…"
                  options={lookups.contacts.map((c) => ({ value: c.id, label: c.name }))}
                />
              )}
            />
          </VaultField>

          <VaultField label="Linked organization">
            <Controller
              control={control}
              name="organizationId"
              render={({ field }) => (
                <CommandSelect
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "")}
                  placeholder="None"
                  searchPlaceholder="Search organizations…"
                  options={lookups.organizations.map((org) => ({ value: org.id, label: org.name }))}
                />
              )}
            />
          </VaultField>
        </>
      )}
    </div>
  );
}
