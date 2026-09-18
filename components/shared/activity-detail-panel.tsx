"use client";

import Link from "next/link";
import { User, ArrowUpRight, Check, Link2 } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { SidePanel } from "./side-panel";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultBody } from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTimeUS } from "@/utils/date";
import type { ActivityRow } from "@/modules/activities/activities.types";
import { pipelineItemHref } from "@/components/pipeline/links";
import type { PipelineItemSummary } from "@/components/pipeline/types";

interface ActivityDetailPanelProps {
  activity: ActivityRow | null;
  members: { id: string; name: string | null; email: string }[];
  /** To link to (and label) the lead/project this activity belongs to. */
  pipelineItems: PipelineItemSummary[];
  onOpenChange: (open: boolean) => void;
  onSetDone: (id: string, done: boolean) => void;
}

function DetailBody({
  activity,
  members,
  pipelineItems,
  onSetDone,
}: {
  activity: ActivityRow;
  members: { id: string; name: string | null; email: string }[];
  pipelineItems: PipelineItemSummary[];
  onSetDone: (id: string, done: boolean) => void;
}) {
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
          href={pipelineItemHref(linkedItem)}
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
        <Button render={<Link href={`/contacts?contact=${activity.contactId}`} />} variant="outline" className="w-full">
          View contact
          <ArrowUpRight />
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

/** /activities' detail view — same Vault(mobile)/SidePanel(desktop) dual pattern as the rest of the app. */
export function ActivityDetailPanel({ activity, members, pipelineItems, onOpenChange, onSetDone }: ActivityDetailPanelProps) {
  const isMobile = useIsMobile();
  const open = activity !== null;

  if (isMobile) {
    return (
      <Vault open={open} onOpenChange={onOpenChange}>
        <VaultContent aria-label={activity?.subject ?? "Activity"}>
          {activity && (
            <>
              <VaultHeader showCloseButton={false}>
                <VaultTitle>{activity.subject}</VaultTitle>
              </VaultHeader>
              <VaultBody>
                <DetailBody activity={activity} members={members} pipelineItems={pipelineItems} onSetDone={onSetDone} />
              </VaultBody>
            </>
          )}
        </VaultContent>
      </Vault>
    );
  }

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={activity?.subject ?? ""}>
      {activity && <DetailBody activity={activity} members={members} pipelineItems={pipelineItems} onSetDone={onSetDone} />}
    </SidePanel>
  );
}
