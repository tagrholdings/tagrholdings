"use client";

import Link from "next/link";
import { Mail, Phone, ArrowUpRight, CheckSquare, Inbox, FolderKanban, ListChecks } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { SidePanel } from "@/components/shared/side-panel";
import { CommandSelect } from "@/components/shared/command-select";
import { ACTIVITY_TYPE_ICONS } from "@/components/shared/activity-form";
import { ActivityProgressBadge } from "@/components/pipeline/ActivityProgressBadge";
import { pipelineItemHref } from "@/components/pipeline/links";
import type { BoardColumn, PipelineItemSummary } from "@/components/pipeline/types";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultBody } from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dueBucket, formatDateUS } from "@/utils/date";
import type { ActivityRow } from "@/modules/activities/activities.types";
import type { ContactSummary as ContactRow } from "@/modules/contacts/contacts.types";

interface ContactDetailPanelProps {
  contact: ContactRow | null;
  organizations: { id: string; name: string }[];
  activities: ActivityRow[];
  pipelineItems: PipelineItemSummary[];
  boards: { id: string; columns: BoardColumn[] }[];
  onOpenChange: (open: boolean) => void;
  onSetOrganization: (contactId: string, organizationId: string | null) => void;
  onCreateOrganization: (contactId: string, name: string) => void;
}

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

function ItemList({
  items,
  stageLabel,
  empty,
}: {
  items: PipelineItemSummary[];
  stageLabel: (item: PipelineItemSummary) => string;
  empty: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={pipelineItemHref(item)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">{item.title}</span>
              {!item.boardIsSystem && <span className="block truncate text-xs text-muted-foreground">{item.boardName}</span>}
            </span>
            <span className="label-kicker shrink-0">{stageLabel(item)}</span>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DetailBody({
  contact,
  organizations,
  activities,
  pipelineItems,
  boards,
  onSetOrganization,
  onCreateOrganization,
}: Omit<ContactDetailPanelProps, "contact" | "onOpenChange"> & { contact: ContactRow }) {
  const columnsByBoard = new Map(boards.map((b) => [b.id, b.columns]));
  const stageLabel = (item: PipelineItemSummary) =>
    columnsByBoard.get(item.boardId)?.find((c) => c.id === item.stage)?.label ?? item.stage;

  const contactItems = pipelineItems.filter((i) => i.contactId === contact.id);
  const leads = contactItems.filter((i) => i.boardIsSystem);
  const projects = contactItems.filter((i) => !i.boardIsSystem);

  const contactActivities = activities
    .filter((a) => a.contactId === contact.id || a.assignedToContactId === contact.id)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const doneCount = contactActivities.filter((a) => a.done).length;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-divider bg-background p-4 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Mail className="size-4 shrink-0 text-muted-foreground" />
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="truncate hover:underline">
              {contact.email}
            </a>
          ) : (
            <span className="text-muted-foreground">No email on file</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-foreground">
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

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Organization</p>
        <CommandSelect
          value={contact.organizationId ?? undefined}
          onChange={(id) => onSetOrganization(contact.id, id ?? null)}
          placeholder="No organization"
          searchPlaceholder="Search or create an organization…"
          options={organizations.map((org) => ({ value: org.id, label: org.name }))}
          createLabel="Create organization"
          onCreate={(name) => onCreateOrganization(contact.id, name)}
        />
      </div>

      <Section icon={Inbox} title="Leads">
        <ItemList items={leads} stageLabel={stageLabel} empty="Not on any lead." />
      </Section>

      <Section icon={FolderKanban} title="Projects">
        <ItemList items={projects} stageLabel={stageLabel} empty="Not part of any project." />
      </Section>

      <Section
        icon={ListChecks}
        title="Activities"
        aside={<ActivityProgressBadge progress={{ done: doneCount, total: contactActivities.length }} />}
      >
        {contactActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activities yet.</p>
        ) : (
          <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
            {contactActivities.map((activity) => {
              const Icon = ACTIVITY_TYPE_ICONS[activity.type] ?? CheckSquare;
              const overdue = !activity.done && dueBucket(activity.dueDate) === "overdue";
              return (
                <li key={activity.id}>
                  <Link
                    href={`/activities?activity=${activity.id}`}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate",
                          activity.done ? "text-muted-foreground line-through" : "text-foreground"
                        )}
                      >
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
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Button render={<Link href={`/contacts/${contact.id}`} />} variant="outline" className="w-full">
        Go to full profile
        <ArrowUpRight />
      </Button>
    </div>
  );
}

/** Vault (mobile) / SidePanel (tablet+desktop) dual pattern — see side-panel.tsx. */
export function ContactDetailPanel({ contact, onOpenChange, ...rest }: ContactDetailPanelProps) {
  const isMobile = useIsMobile();
  const open = contact !== null;

  if (isMobile) {
    return (
      <Vault open={open} onOpenChange={onOpenChange}>
        <VaultContent aria-label={contact?.name ?? "Contact"}>
          {contact && (
            <>
              <VaultHeader showCloseButton={false}>
                <VaultTitle>{contact.name}</VaultTitle>
              </VaultHeader>
              <VaultBody>
                <DetailBody contact={contact} {...rest} />
              </VaultBody>
            </>
          )}
        </VaultContent>
      </Vault>
    );
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={contact?.name ?? ""}
      description={contact?.organizationName ?? undefined}
    >
      {contact && <DetailBody contact={contact} {...rest} />}
    </SidePanel>
  );
}
