"use client";

import { useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Phone, Users, CheckSquare, Mail, Repeat, ChevronDown } from "lucide-react";
import { VaultField, VaultInput } from "@/components/ui/vault";
import type { PipelineItemSummary } from "@/components/pipeline/types";
import { CommandSelect } from "@/components/shared/command-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { parseLocalDateTime, toDateInputValue } from "@/utils/date";
import {
  ACTIVITY_TYPES,
  ACTIVITY_PRIORITIES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_PRIORITY_LABELS,
  type ActivityRow,
  type NewActivity,
} from "@/modules/activities/activities.types";

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
  priority: z.enum(ACTIVITY_PRIORITIES).optional(),
  notes: z.string().optional(),
  /** "user:<id>" or "contact:<id>" — one picker over two different owner kinds. */
  assignedTo: z.string().optional(),
  contactId: z.string().optional(),
  organizationId: z.string().optional(),
  pipelineItemId: z.string().optional(),
});

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

/** Due date defaults to today so a new activity lands on /activities' "This week" board right away. */
export function activityFormDefaults(overrides: Partial<ActivityFormValues> = {}): ActivityFormValues {
  return {
    subject: "",
    type: "task",
    dueDate: toDateInputValue(new Date()),
    dueTime: "",
    priority: undefined,
    notes: "",
    assignedTo: undefined,
    contactId: undefined,
    organizationId: undefined,
    pipelineItemId: undefined,
    ...overrides,
  };
}

export function toNewActivity(values: ActivityFormValues): NewActivity {
  const [assignedKind, assignedId] = values.assignedTo?.split(":") ?? [];
  return {
    subject: values.subject.trim(),
    type: values.type,
    dueDate: values.dueDate ? parseLocalDateTime(values.dueDate, values.dueTime || undefined) : undefined,
    priority: values.priority,
    notes: values.notes?.trim() || undefined,
    contactId: values.contactId || undefined,
    organizationId: values.organizationId || undefined,
    pipelineItemId: values.pipelineItemId || undefined,
    assignedToUserId: assignedKind === "user" ? assignedId : undefined,
    assignedToContactId: assignedKind === "contact" ? assignedId : undefined,
  };
}

export interface ActivityLookups {
  contacts: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
  members: { id: string; name: string | null; email: string }[];
  pipelineItems: PipelineItemSummary[];
}

/** The row an optimistic "add" shows until the server's revalidated list replaces it. */
export function buildOptimisticActivity(input: NewActivity, lookups: ActivityLookups): ActivityRow {
  const nameOf = (list: { id: string; name: string }[], id?: string | null) => list.find((x) => x.id === id)?.name ?? null;
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    type: input.type,
    subject: input.subject,
    dueDate: input.dueDate ?? null,
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
    assignedToUserId: input.assignedToUserId ?? null,
    assignedToContactId: input.assignedToContactId ?? null,
    assignedToContactName: nameOf(lookups.contacts, input.assignedToContactId),
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
export function ActivityFormFields({ form, lookups, showPipelineItem = true, collapsibleExtras = false }: ActivityFormFieldsProps) {
  const { register, control, watch, formState: { errors } } = form;
  const [showExtras, setShowExtras] = useState(!collapsibleExtras);
  const selectedType = watch("type");

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
          <VaultInput type="date" {...register("dueDate")} />
        </VaultField>
        <VaultField label="Time (optional)">
          <VaultInput type="time" {...register("dueTime")} />
        </VaultField>
      </div>

      <VaultField label="Priority">
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <PillGroup
              allowNone
              value={field.value}
              onChange={field.onChange}
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
                    onChange={field.onChange}
                    placeholder="Unassigned"
                    searchPlaceholder="Search team or contacts…"
                    groups={[
                      { label: "Team", options: lookups.members.map((m) => ({ value: `user:${m.id}`, label: m.name ?? m.email })) },
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
                    onChange={field.onChange}
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

          <VaultField label="Linked person">
            <Controller
              control={control}
              name="contactId"
              render={({ field }) => (
                <CommandSelect
                  value={field.value}
                  onChange={field.onChange}
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
                  onChange={field.onChange}
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
