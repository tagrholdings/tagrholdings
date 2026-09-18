"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, CheckSquare, FolderKanban, Globe, Inbox, ListChecks, Pencil, Users, X } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { SidePanel } from "@/components/shared/side-panel";
import { ACTIVITY_TYPE_ICONS } from "@/components/shared/activity-form";
import { ActivityProgressBadge } from "@/components/pipeline/ActivityProgressBadge";
import { pipelineItemHref } from "@/components/pipeline/links";
import type { BoardColumn, PipelineItemSummary } from "@/components/pipeline/types";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultBody, VaultField, VaultInput } from "@/components/ui/vault";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dueBucket, formatDateUS } from "@/utils/date";
import { initialsFor } from "@/lib/utils";
import type { ActivityRow } from "@/modules/activities/activities.types";
import type { OrganizationSummary } from "@/modules/organizations/organizations.types";
import type { ContactSummary as ContactRow } from "@/modules/contacts/contacts.types";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  website: z.union([z.url("Enter a valid URL."), z.literal("")]).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface OrganizationDetailPanelProps {
  organization: OrganizationSummary | null;
  contacts: ContactRow[];
  pipelineItems: PipelineItemSummary[];
  activities: ActivityRow[];
  boards: { id: string; columns: BoardColumn[] }[];
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: { name: string; website?: string; notes?: string }) => Promise<void> | void;
}

function Section({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: typeof Users;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="font-serif text-base font-semibold text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

function DetailBody({
  organization,
  contacts,
  pipelineItems,
  activities,
  boards,
  onSave,
}: Omit<OrganizationDetailPanelProps, "organization" | "onOpenChange"> & { organization: OrganizationSummary }) {
  const [editing, setEditing] = useState(false);
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: { name: organization.name, website: organization.website ?? "", notes: organization.notes ?? "" },
  });

  async function onSubmit(values: FormValues) {
    await onSave(organization.id, { name: values.name.trim(), website: values.website || undefined, notes: values.notes?.trim() || undefined });
    setEditing(false);
  }

  const columnsByBoard = new Map(boards.map((b) => [b.id, b.columns]));
  const stageLabel = (item: PipelineItemSummary) => columnsByBoard.get(item.boardId)?.find((c) => c.id === item.stage)?.label ?? item.stage;

  const orgContacts = contacts.filter((c) => c.organizationId === organization.id);
  const orgItems = pipelineItems.filter((i) => i.organizationId === organization.id);
  const leads = orgItems.filter((i) => i.boardIsSystem);
  const projects = orgItems.filter((i) => !i.boardIsSystem);
  const orgActivities = activities
    .filter((a) => a.organizationId === organization.id)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const doneCount = orgActivities.filter((a) => a.done).length;

  if (editing) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <VaultField label="Name" required error={errors.name?.message}>
          <VaultInput {...register("name")} />
        </VaultField>
        <VaultField label="Website" error={errors.website?.message}>
          <VaultInput type="url" placeholder="https://acme.com" {...register("website")} />
        </VaultField>
        <VaultField label="Notes">
          <Textarea placeholder="Add any context…" {...register("notes")} />
        </VaultField>
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2 rounded-lg border border-divider bg-background p-4 text-sm">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-foreground">
            <Globe className="size-4 shrink-0 text-muted-foreground" />
            {organization.website ? (
              <a
                href={organization.website}
                target="_blank"
                rel="noreferrer"
                className="truncate hover:underline"
              >
                {organization.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="text-muted-foreground">No website on file</span>
            )}
          </div>
          {organization.notes && <p className="whitespace-pre-line text-sm text-foreground">{organization.notes}</p>}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit organization"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </div>

      <Section icon={Users} title="Contacts">
        {orgContacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        ) : (
          <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
            {orgContacts.map((contact) => (
              <li key={contact.id}>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold text-foreground">
                    {initialsFor(contact.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{contact.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Inbox} title="Leads">
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not on any lead.</p>
        ) : (
          <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
            {leads.map((item) => (
              <li key={item.id}>
                <Link href={pipelineItemHref(item)} className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.title}</span>
                  <span className="label-kicker shrink-0">{stageLabel(item)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={FolderKanban} title="Projects">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not part of any project.</p>
        ) : (
          <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
            {projects.map((item) => (
              <li key={item.id}>
                <Link href={pipelineItemHref(item)} className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{item.boardName}</span>
                  <span className="label-kicker shrink-0">{stageLabel(item)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={ListChecks}
        title="Activities"
        aside={<ActivityProgressBadge progress={{ done: doneCount, total: orgActivities.length }} />}
      >
        {orgActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activities yet.</p>
        ) : (
          <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
            {orgActivities.map((activity) => {
              const Icon = ACTIVITY_TYPE_ICONS[activity.type] ?? CheckSquare;
              const overdue = !activity.done && dueBucket(activity.dueDate) === "overdue";
              return (
                <li key={activity.id}>
                  <Link
                    href={`/activities?activity=${activity.id}`}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className={cn("min-w-0 flex-1 truncate", activity.done ? "text-muted-foreground line-through" : "text-foreground")}>
                      {activity.subject}
                    </span>
                    <span className={cn("shrink-0 text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                      {activity.done ? "Done" : activity.dueDate ? formatDateUS(activity.dueDate, { month: "short", day: "numeric" }) : "No date"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** Vault (mobile) / SidePanel (tablet+desktop) dual pattern — see side-panel.tsx. */
export function OrganizationDetailPanel({ organization, onOpenChange, ...rest }: OrganizationDetailPanelProps) {
  const isMobile = useIsMobile();
  const open = organization !== null;

  if (isMobile) {
    return (
      <Vault open={open} onOpenChange={onOpenChange}>
        <VaultContent aria-label={organization?.name ?? "Organization"}>
          {organization && (
            <>
              <VaultHeader showCloseButton={false}>
                <VaultTitle>{organization.name}</VaultTitle>
              </VaultHeader>
              <VaultBody>
                <DetailBody organization={organization} {...rest} />
              </VaultBody>
            </>
          )}
        </VaultContent>
      </Vault>
    );
  }

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={organization?.name ?? ""}>
      {organization && <DetailBody organization={organization} {...rest} />}
    </SidePanel>
  );
}
