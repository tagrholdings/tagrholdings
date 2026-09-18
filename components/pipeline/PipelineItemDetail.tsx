"use client";

import Link from "next/link";
import { Building2, User, ArrowUpRight } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { cn } from "@/lib/utils";
import { SidePanel } from "@/components/shared/side-panel";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultBody } from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import type { ActivityLookups } from "@/components/shared/activity-form";
import type { ActivityRow } from "@/modules/activities/activities.types";
import { PipelineItemActivities } from "./PipelineItemActivities";
import type { PipelineItemRow, BoardColumn } from "./types";

interface PipelineItemDetailProps {
  item: PipelineItemRow | null;
  columns: BoardColumn[];
  activities: ActivityRow[];
  lookups: ActivityLookups;
  onOpenChange: (open: boolean) => void;
  onMoveStage: (id: string, stage: string) => void;
}

function DetailBody({
  item,
  columns,
  activities,
  lookups,
  onMoveStage,
}: Omit<PipelineItemDetailProps, "item" | "onOpenChange"> & { item: PipelineItemRow }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Stage</p>
        {/* Pills, not Select — Select opens its own Vault on mobile, and this
            already sits inside one (see design.md's "Relational pickers"). */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {columns.map((column) => (
            <button
              key={column.id}
              type="button"
              aria-pressed={item.stage === column.id}
              onClick={() => item.stage !== column.id && onMoveStage(item.id, column.id)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                item.stage === column.id
                  ? "border-accent bg-accent text-ink"
                  : "border-divider bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {column.label}
            </button>
          ))}
        </div>
      </div>

      {(item.organizationName || item.contactName) && (
        <div className="space-y-3 rounded-lg border border-divider bg-background p-4 text-sm">
          {item.organizationName && (
            <div className="flex items-center gap-2 text-foreground">
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
              {item.organizationName}
            </div>
          )}
          {item.contactName && (
            <div className="flex items-center gap-2 text-foreground">
              <User className="size-4 shrink-0 text-muted-foreground" />
              {item.contactName}
            </div>
          )}
        </div>
      )}

      {item.notes && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{item.notes}</p>
        </div>
      )}

      {item.contactId && (
        <Button render={<Link href={`/contacts?contact=${item.contactId}`} />} variant="outline" className="w-full">
          View contact
          <ArrowUpRight />
        </Button>
      )}

      <PipelineItemActivities
        // Remount per item so the inline form's defaults (linked contact/org) follow the selection.
        key={item.id}
        pipelineItemId={item.id}
        contactId={item.contactId}
        organizationId={item.organizationId}
        activities={activities.filter((a) => a.pipelineItemId === item.id)}
        lookups={lookups}
      />
    </div>
  );
}

export function PipelineItemDetail({ item, columns, activities, lookups, onOpenChange, onMoveStage }: PipelineItemDetailProps) {
  const isMobile = useIsMobile();
  const open = item !== null;

  if (isMobile) {
    return (
      <Vault open={open} onOpenChange={onOpenChange}>
        <VaultContent aria-label={item?.title ?? "Item"}>
          {item && (
            <>
              <VaultHeader showCloseButton={false}>
                <VaultTitle>{item.title}</VaultTitle>
              </VaultHeader>
              <VaultBody>
                <DetailBody item={item} columns={columns} activities={activities} lookups={lookups} onMoveStage={onMoveStage} />
              </VaultBody>
            </>
          )}
        </VaultContent>
      </Vault>
    );
  }

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={item?.title ?? ""} description={item?.organizationName ?? undefined}>
      {item && <DetailBody item={item} columns={columns} activities={activities} lookups={lookups} onMoveStage={onMoveStage} />}
    </SidePanel>
  );
}
