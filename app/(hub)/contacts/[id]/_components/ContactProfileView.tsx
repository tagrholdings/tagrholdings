"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useOptimisticAction } from "next-safe-action/hooks";
import { ArrowUpRight, Building2, Check, CheckSquare, FolderKanban, Inbox, ListChecks, Mail, Pencil, Phone, X } from "lucide-react";
import { PipelineItemDetail } from "@/components/pipeline/PipelineItemDetail";
import { ActivityDetailPanel } from "@/components/shared/activity-detail-panel";
import { ACTIVITY_TYPE_ICONS } from "@/components/shared/activity-form";
import { ActivityProgressBadge } from "@/components/pipeline/ActivityProgressBadge";
import { CommandSelect } from "@/components/shared/command-select";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { VaultField, VaultInput } from "@/components/ui/vault";
import { notify } from "@/components/ui/toaster";
import { cn, initialsFor } from "@/lib/utils";
import { dueBucket, formatDateUS } from "@/utils/date";
import { updateContactAction } from "@/modules/contacts/contacts.actions";
import { createOrganizationAction } from "@/modules/organizations/organizations.actions";
import { moveStageAction } from "@/modules/pipeline/pipeline.actions";
import { setActivityDoneAction } from "@/modules/activities/activities.actions";
import type { OrganizationSummary } from "@/modules/organizations/organizations.types";
import type { ActivityRow } from "@/modules/activities/activities.types";
import type { BoardColumn, PipelineItemSummary } from "@/components/pipeline/types";
import type { ContactSummary } from "@/modules/contacts/contacts.types";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.union([z.email("Enter a valid email address."), z.literal("")]).optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Selection = { type: "item"; id: string } | { type: "activity"; id: string } | null;

function Section({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: typeof Mail;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-divider bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="font-serif text-base font-semibold text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

/**
 * The full contact profile — editable info + organization, and its leads,
 * projects and activities. Clicking one of those opens the exact same
 * `PipelineItemDetail` / `ActivityDetailPanel` side panels used on
 * /leads, /pipeline and /activities, instead of navigating away.
 */
export function ContactProfileView({
  contact: initialContact,
  contacts,
  organizations: initialOrganizations,
  pipelineItems: initialPipelineItems,
  activities: initialActivities,
  boards,
  members,
}: {
  contact: ContactSummary;
  contacts: { id: string; name: string }[];
  organizations: OrganizationSummary[];
  pipelineItems: PipelineItemSummary[];
  activities: ActivityRow[];
  boards: { id: string; columns: BoardColumn[] }[];
  members: { id: string; name: string | null; email: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);

  const [createdOrganizations, setCreatedOrganizations] = useState<OrganizationSummary[]>([]);
  const organizations = [...initialOrganizations, ...createdOrganizations.filter((o) => !initialOrganizations.some((i) => i.id === o.id))];
  const createdNames = useRef(new Map<string, string>());

  const { execute: updateContact, optimisticState: contact } = useOptimisticAction(updateContactAction, {
    currentState: initialContact,
    updateFn: (state, input) => ({
      ...state,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email ?? null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
      ...(input.organizationId !== undefined
        ? {
            organizationId: input.organizationId,
            organizationName: input.organizationId
              ? (organizations.find((o) => o.id === input.organizationId)?.name ??
                createdNames.current.get(input.organizationId) ??
                state.organizationName)
              : null,
          }
        : {}),
    }),
    onError: ({ error }) => notify.error(error.serverError ?? "Couldn't update that contact. Please try again."),
  });

  const { execute: moveStage, optimisticState: pipelineItems } = useOptimisticAction(moveStageAction, {
    currentState: initialPipelineItems,
    updateFn: (state, input) => state.map((item) => (item.id === input.id ? { ...item, stage: input.stage } : item)),
    onError: ({ error }) => notify.error(error.serverError ?? "Couldn't move that item. Please try again."),
  });

  const { execute: setDone, optimisticState: activities } = useOptimisticAction(setActivityDoneAction, {
    currentState: initialActivities,
    updateFn: (state, input) => state.map((a) => (a.id === input.id ? { ...a, done: input.done } : a)),
    onError: ({ error }) => notify.error(error.serverError ?? "Couldn't update that activity. Please try again."),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: { name: contact.name, email: contact.email ?? "", phone: contact.phone ?? "" },
  });

  async function onSubmit(values: FormValues) {
    updateContact({
      id: contact.id,
      name: values.name.trim(),
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
    });
    setEditing(false);
  }

  async function createOrganization(name: string) {
    const result = await createOrganizationAction({ name });
    const organization = result?.data?.organization;
    if (!organization) {
      notify.error(result?.serverError ?? "Couldn't create that organization. Please try again.");
      return;
    }
    createdNames.current.set(organization.id, organization.name);
    setCreatedOrganizations((prev) => [...prev, organization]);
    notify.success(`Organization "${organization.name}" created.`);
    updateContact({ id: contact.id, organizationId: organization.id });
  }

  const columnsByBoard = new Map(boards.map((b) => [b.id, b.columns]));
  const stageLabel = (item: PipelineItemSummary) => columnsByBoard.get(item.boardId)?.find((c) => c.id === item.stage)?.label ?? item.stage;

  const contactItems = pipelineItems.filter((i) => i.contactId === contact.id);
  const leads = contactItems.filter((i) => i.boardIsSystem);
  const projects = contactItems.filter((i) => !i.boardIsSystem);

  const contactActivities = activities
    .filter((a) => a.contactId === contact.id || a.assignedToContactId === contact.id)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const doneCount = contactActivities.filter((a) => a.done).length;

  const selectedItem = selection?.type === "item" ? (pipelineItems.find((i) => i.id === selection.id) ?? null) : null;
  const selectedActivity = selection?.type === "activity" ? (activities.find((a) => a.id === selection.id) ?? null) : null;

  return (
    // min-w-0 on both this row and the left column is what lets the left
    // side actually shrink when a detail panel opens (see side-panel.tsx).
    <div className="flex min-w-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="rounded-lg border border-divider bg-surface p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-alt text-base font-semibold text-foreground">
                {initialsFor(contact.name)}
              </span>
              {!editing && (
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-xl font-semibold text-foreground">{contact.name}</h2>
                  {contact.organizationName && (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="size-3.5" />
                      {contact.organizationName}
                    </p>
                  )}
                </div>
              )}
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit contact"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
              <VaultField label="Name" required error={errors.name?.message}>
                <VaultInput {...register("name")} />
              </VaultField>
              <div className="grid gap-3 sm:grid-cols-2">
                <VaultField label="Email" error={errors.email?.message}>
                  <VaultInput type="email" placeholder="jane@company.com" {...register("email")} />
                </VaultField>
                <VaultField label="Phone">
                  <VaultInput type="tel" placeholder="(555) 000-0000" {...register("phone")} />
                </VaultField>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    reset();
                    setEditing(false);
                  }}
                >
                  <X />
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isSubmitting}>
                  <Check />
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-md border border-divider bg-background px-3 py-2.5 text-sm text-foreground">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="truncate hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No email on file</span>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-md border border-divider bg-background px-3 py-2.5 text-sm text-foreground">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="hover:underline">
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No phone on file</span>
                )}
              </div>
            </div>
          )}
        </div>

        <Section
          icon={Building2}
          title="Organization"
          aside={
            contact.organizationId && (
              <Link
                href={`/contacts?org=${contact.organizationId}`}
                className="ml-auto flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover"
              >
                View organization
                <ArrowUpRight className="size-3" />
              </Link>
            )
          }
        >
          <CommandSelect
            value={contact.organizationId ?? undefined}
            onChange={(id) => updateContact({ id: contact.id, organizationId: id ?? null })}
            placeholder="No organization"
            searchPlaceholder="Search or create an organization…"
            options={organizations.map((org) => ({ value: org.id, label: org.name }))}
            createLabel="Create organization"
            onCreate={createOrganization}
          />
        </Section>

        <Section icon={Inbox} title="Leads">
          {leads.length === 0 ? (
            <Empty className="border border-dashed border-divider py-8">
              <EmptyTitle className="text-sm">Not on any lead yet</EmptyTitle>
            </Empty>
          ) : (
            <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
              {leads.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelection({ type: "item", id: item.id })}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.title}</span>
                    <span className="label-kicker shrink-0">{stageLabel(item)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={FolderKanban} title="Projects">
          {projects.length === 0 ? (
            <Empty className="border border-dashed border-divider py-8">
              <EmptyTitle className="text-sm">Not part of any project yet</EmptyTitle>
            </Empty>
          ) : (
            <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
              {projects.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelection({ type: "item", id: item.id })}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{item.boardName}</span>
                    <span className="label-kicker shrink-0">{stageLabel(item)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          icon={ListChecks}
          title="Activities"
          aside={<ActivityProgressBadge progress={{ done: doneCount, total: contactActivities.length }} />}
        >
          {contactActivities.length === 0 ? (
            <Empty className="border border-dashed border-divider py-8">
              <EmptyTitle className="text-sm">No activity logged yet</EmptyTitle>
            </Empty>
          ) : (
            <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
              {contactActivities.map((activity) => {
                const Icon = ACTIVITY_TYPE_ICONS[activity.type] ?? CheckSquare;
                const overdue = !activity.done && dueBucket(activity.dueDate) === "overdue";
                return (
                  <li key={activity.id}>
                    <button
                      type="button"
                      onClick={() => setSelection({ type: "activity", id: activity.id })}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate", activity.done ? "text-muted-foreground line-through" : "text-foreground")}>
                          {activity.subject}
                        </span>
                        {activity.pipelineItemTitle && (
                          <span className="block truncate text-xs text-muted-foreground">{activity.pipelineItemTitle}</span>
                        )}
                      </span>
                      <span className={cn("shrink-0 text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                        {activity.done
                          ? "Done"
                          : activity.dueDate
                            ? formatDateUS(activity.dueDate, { month: "short", day: "numeric" })
                            : "No date"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <PipelineItemDetail
        item={selectedItem}
        columns={selectedItem ? (columnsByBoard.get(selectedItem.boardId) ?? []) : []}
        activities={activities}
        lookups={{ contacts, organizations, members, pipelineItems }}
        onOpenChange={(open) => !open && setSelection(null)}
        onMoveStage={(id, stage) => moveStage({ id, stage })}
      />

      <ActivityDetailPanel
        activity={selectedActivity}
        members={members}
        pipelineItems={pipelineItems}
        onOpenChange={(open) => !open && setSelection(null)}
        onSetDone={(id, done) => setDone({ id, done })}
      />
    </div>
  );
}
