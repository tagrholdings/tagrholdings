"use client";

import { useState } from "react";
import Link from "next/link";
import { User, ArrowUpRight, Check, Link2, Pencil } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { SidePanel } from "./side-panel";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultBody } from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTimeUS } from "@/utils/date";
import type { ActivityRow } from "@/modules/activities/activities.types";
import { pipelineItemHref } from "@/components/pipeline/links";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import type { ActivityLookups } from "./activity-form";
import { ActivityEditForm } from "./activity-edit-form";

interface ActivityDetailPanelProps {
  activity: ActivityRow | null;
  /** Feeds the edit form's pickers, and labels/links the lead or project this activity belongs to. */
  lookups: ActivityLookups;
  onOpenChange: (open: boolean) => void;
  onSetDone: (id: string, done: boolean) => void;
}

function DetailBody({
  activity,
  members,
  pipelineItems,
  onSetDone,
  onEdit,
}: {
  activity: ActivityRow;
  members: ActivityLookups["members"];
  pipelineItems: ActivityLookups["pipelineItems"];
  onSetDone: (id: string, done: boolean) => void;
  onEdit: () => void;
}) {
  const path = useWorkspacePath();
  // An activity still being created has no server id yet, so there is nothing to edit.
  const canEdit = !activity.id.startsWith("optimistic-");
  const linkedItem = pipelineItems.find((i) => i.id === activity.pipelineItemId);
  const assignee =
    activity.assignedToContactName ??
    members.find((m) => m.id === activity.assignedToUserId)?.name ??
    members.find((m) => m.id === activity.assignedToUserId)?.email ??
    null;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-lg border border-divider bg-background p-4 text-sm">
        <div className="flex items-center justify-between text-foreground">
          <span className="text-muted-foreground">Type</span>
          <span className="capitalize">{activity.type.replace("_", " ")}</span>
        </div>
        {activity.dueDate && (
          <div className="flex items-center justify-between text-foreground">
            <span className="text-muted-foreground">Due</span>
            <span>{formatDateTimeUS(activity.dueDate)}</span>
          </div>
        )}
        {activity.notify && (
          <div className="flex items-center justify-between text-foreground">
            <span className="text-muted-foreground">Notification</span>
            <span>Push reminder at the due time</span>
          </div>
        )}
        <div className="flex items-center justify-between text-foreground">
          <span className="text-muted-foreground">Created</span>
          <span>{formatDateTimeUS(activity.createdAt)}</span>
        </div>
        {activity.priority && (
          <div className="flex items-center justify-between text-foreground">
            <span className="text-muted-foreground">Priority</span>
            <span className="capitalize">{activity.priority}</span>
          </div>
        )}
        {assignee && (
          <div className="flex items-center justify-between text-foreground">
            <span className="text-muted-foreground">Assigned to</span>
            <span>{assignee}</span>
          </div>
        )}
        {activity.organizationName && (
          <div className="flex items-center justify-between text-foreground">
            <span className="text-muted-foreground">Organization</span>
            <span>{activity.organizationName}</span>
          </div>
        )}
      </div>

      {activity.pipelineItemTitle && linkedItem && (
        <Link
          href={path(pipelineItemHref(linkedItem))}
          className="flex items-center gap-2 rounded-lg border border-divider bg-background p-3 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{activity.pipelineItemTitle}</span>
            <span className="block text-xs text-muted-foreground">
              {linkedItem.boardIsSystem ? "Lead" : `Project · ${linkedItem.boardName}`}
            </span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {activity.notes && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{activity.notes}</p>
        </div>
      )}

      {activity.contactName && (
        <div className="flex items-center gap-2 text-sm text-foreground">
          <User className="size-4 shrink-0 text-muted-foreground" />
          {activity.contactName}
        </div>
      )}

      {activity.contactId && (
        <Button render={<Link href={path(`/contacts?contact=${activity.contactId}`)} />} variant="outline" className="w-full">
          View contact
          <ArrowUpRight />
        </Button>
      )}

      {canEdit && (
        <Button variant="outline" className="w-full" onClick={onEdit}>
          <Pencil />
          Edit activity
        </Button>
      )}

      <button
        type="button"
        onClick={() => onSetDone(activity.id, !activity.done)}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors",
          activity.done
            ? "border-accent bg-accent text-ink"
            : "border-divider bg-background text-foreground hover:bg-muted"
        )}
      >
        <Check className="size-4" />
        {activity.done ? "Mark as undone" : "Mark as done"}
      </button>
    </div>
  );
}

/** The panel's content: the read-only details, or — after "Edit activity" — the edit form. Keyed per activity by its caller, so it always opens on the details. */
function PanelContent({ activity, lookups, onSetDone }: { activity: ActivityRow; lookups: ActivityLookups; onSetDone: (id: string, done: boolean) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <ActivityEditForm activity={activity} lookups={lookups} onDone={() => setEditing(false)} />;
  return (
    <DetailBody
      activity={activity}
      members={lookups.members}
      pipelineItems={lookups.pipelineItems}
      onSetDone={onSetDone}
      onEdit={() => setEditing(true)}
    />
  );
}

/** /activities' detail view — same Vault(mobile)/SidePanel(desktop) dual pattern as the rest of the app. */
export function ActivityDetailPanel({ activity, lookups, onOpenChange, onSetDone }: ActivityDetailPanelProps) {
  const isMobile = useIsMobile();
  const open = activity !== null;

  if (isMobile) {
    return (
      <Vault open={open} onOpenChange={onOpenChange}>
        <VaultContent aria-label={activity?.subject ?? "Activity"}>
          {activity && (
            <>
              <VaultHeader>
                <VaultTitle>{activity.subject}</VaultTitle>
              </VaultHeader>
              <VaultBody>
                <PanelContent key={activity.id} activity={activity} lookups={lookups} onSetDone={onSetDone} />
              </VaultBody>
            </>
          )}
        </VaultContent>
      </Vault>
    );
  }

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={activity?.subject ?? ""}>
      {activity && <PanelContent key={activity.id} activity={activity} lookups={lookups} onSetDone={onSetDone} />}
    </SidePanel>
  );
}
