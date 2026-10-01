"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, User, ArrowUpRight, Pencil } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { cn } from "@/lib/utils";
import { SidePanel } from "@/components/shared/side-panel";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultBody } from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import type { ActivityLookups } from "@/components/shared/activity-form";
import type { ActivityRow } from "@/modules/activities/activities.types";
import { PipelineItemActivities } from "./PipelineItemActivities";
import { PipelineItemEditForm } from "./PipelineItemEditForm";
import type { PipelineItemRow, BoardColumn } from "./types";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";

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
  onEdit,
}: Omit<PipelineItemDetailProps, "item" | "onOpenChange"> & { item: PipelineItemRow; onEdit: () => void }) {
  const path = useWorkspacePath();
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Stage</p>
        {/* Pills, not Select — Select opens its own Vault on mobile, and this
            already sits inside one (see design.md's "Relational pickers"). */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {columns.map((column) => (
            <motion.button
              key={column.id}
              type="button"
              aria-pressed={item.stage === column.id}
              onClick={() => item.stage !== column.id && onMoveStage(item.id, column.id)}
              // Press: dips on touch. Confirm: the newly selected pill pops once (keyed on selection, so it
              // plays when the stage actually changes — including when the change is applied optimistically).
              initial={false}
              whileTap={{ scale: 0.92 }}
              animate={item.stage === column.id ? { scale: [1, 1.14, 1] } : { scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                item.stage === column.id
                  ? "border-accent bg-accent text-ink"
                  : "border-divider bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {column.label}
            </motion.button>
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
        <Button render={<Link href={path(`/contacts?contact=${item.contactId}`)} />} variant="outline" className="w-full">
          View contact
          <ArrowUpRight />
        </Button>
      )}

      {/* An item still being created has no server id yet, so there is nothing to edit. */}
      {!item.id.startsWith("optimistic-") && (
        <Button variant="outline" className="w-full" onClick={onEdit}>
          <Pencil />
          Edit details
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

/** The panel's content: the details, or — after "Edit details" — the edit form. Keyed per item by its caller, so it always opens on the details. */
function PanelContent({ item, columns, activities, lookups, onMoveStage }: Omit<PipelineItemDetailProps, "item" | "onOpenChange"> & { item: PipelineItemRow }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <PipelineItemEditForm item={item} contacts={lookups.contacts} organizations={lookups.organizations} onDone={() => setEditing(false)} />;
  }
  return <DetailBody item={item} columns={columns} activities={activities} lookups={lookups} onMoveStage={onMoveStage} onEdit={() => setEditing(true)} />;
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
              <VaultHeader>
                <VaultTitle>{item.title}</VaultTitle>
              </VaultHeader>
              <VaultBody>
                <PanelContent key={item.id} item={item} columns={columns} activities={activities} lookups={lookups} onMoveStage={onMoveStage} />
              </VaultBody>
            </>
          )}
        </VaultContent>
      </Vault>
    );
  }

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={item?.title ?? ""} description={item?.organizationName ?? undefined}>
      {item && <PanelContent key={item.id} item={item} columns={columns} activities={activities} lookups={lookups} onMoveStage={onMoveStage} />}
    </SidePanel>
  );
}
