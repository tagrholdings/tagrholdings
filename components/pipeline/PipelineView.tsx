"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { LayoutGrid, List } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { notify } from "@/components/ui/toaster";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import type { ActivityLookups } from "@/components/shared/activity-form";
import { createPipelineItemAction, moveStageAction } from "@/modules/pipeline/pipeline.actions";
import type { NewPipelineItem } from "@/modules/pipeline/pipeline.types";
import type { ActivityRow } from "@/modules/activities/activities.types";
import { PipelineBoard } from "./PipelineBoard";
import { PipelineListView } from "./PipelineListView";
import { PipelineItemDetail } from "./PipelineItemDetail";
import { CreatePipelineItemVault } from "./CreatePipelineItemVault";
import type { ActivityProgress, PipelineItemRow, PipelineBoardRow } from "./types";

type View = "board" | "list";

// Two mutation kinds (add, stage move) against one list — design.md's
// documented exception to useOptimisticAction, same as the Activities board.
type Patch = { kind: "add"; item: PipelineItemRow } | { kind: "move"; id: string; stage: string };

function applyPatch(state: PipelineItemRow[], patch: Patch): PipelineItemRow[] {
  if (patch.kind === "add") return [...state, patch.item];
  return state.map((item) => (item.id === patch.id ? { ...item, stage: patch.stage } : item));
}

/**
 * One board's kanban + list, item detail and "New" vault. Shared by
 * /leads (the system "Leads" board) and /pipeline (one project board
 * per tab) — both are the same `pipeline_items` data, just different boards.
 */
export function PipelineView({
  board,
  items: initialItems,
  activities,
  lookups,
  itemNoun = "item",
  initialSelectedId = null,
}: {
  board: PipelineBoardRow;
  items: PipelineItemRow[];
  activities: ActivityRow[];
  lookups: ActivityLookups;
  itemNoun?: string;
  initialSelectedId?: string | null;
}) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<View | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  // Until the user picks one, the default follows the device: List on
  // mobile, Board elsewhere (no effect needed — just derived).
  const resolvedView: View = view ?? (isMobile ? "list" : "board");

  const [optimisticItems, addPatch] = useOptimistic(initialItems, applyPatch);
  const [, startTransition] = useTransition();

  function handleMoveStage(id: string, stage: string) {
    startTransition(async () => {
      addPatch({ kind: "move", id, stage });
      const result = await moveStageAction({ id, stage });
      if (result?.serverError) notify.error(result.serverError);
    });
  }

  /** Resolves/rejects with the action so CreatePipelineItemVault's button can show success/error. */
  function handleCreate(input: NewPipelineItem) {
    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        addPatch({
          kind: "add",
          item: {
            id: `optimistic-${crypto.randomUUID()}`,
            boardId: board.id,
            title: input.title,
            stage: input.stage ?? board.columns[0]?.id ?? "",
            notes: input.notes ?? null,
            contactId: input.contactId ?? null,
            contactName: lookups.contacts.find((c) => c.id === input.contactId)?.name ?? null,
            organizationId: input.organizationId ?? null,
            organizationName: lookups.organizations.find((o) => o.id === input.organizationId)?.name ?? null,
          },
        });
        const result = await createPipelineItemAction(input);
        if (result?.serverError || result?.validationErrors) {
          notify.error(result.serverError ?? `Couldn't create that ${itemNoun}. Please try again.`);
          reject(new Error("createPipelineItemAction failed"));
          return;
        }
        resolve();
      });
    });
  }

  const progressByItem = useMemo(() => {
    const map: Record<string, ActivityProgress> = {};
    for (const activity of activities) {
      if (!activity.pipelineItemId) continue;
      const entry = (map[activity.pipelineItemId] ??= { done: 0, total: 0 });
      entry.total += 1;
      if (activity.done) entry.done += 1;
    }
    return map;
  }, [activities]);

  const query = search.trim().toLowerCase();
  const filteredItems = query
    ? optimisticItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.organizationName?.toLowerCase().includes(query) ||
          item.contactName?.toLowerCase().includes(query)
      )
    : optimisticItems;

  const selected = optimisticItems.find((item) => item.id === selectedId) ?? null;

  return (
    // min-w-0 on both this row and the left column is what lets the left
    // side actually shrink when SidePanel opens.
    <div className="flex min-w-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* The toolbar (and the vault inside it) stays mounted even while the
            board is empty, so creating the first item doesn't unmount the
            vault mid-animation. */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Filter by title, organization or contact"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            containerClassName="w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs"
          />

          <SegmentedControl
            value={resolvedView}
            onChange={setView}
            options={[
              { value: "board", ariaLabel: "Board view", icon: LayoutGrid },
              { value: "list", ariaLabel: "List view", icon: List },
            ]}
          />
          <CreatePipelineItemVault
            boardId={board.id}
            columns={board.columns}
            contacts={lookups.contacts}
            organizations={lookups.organizations}
            itemNoun={itemNoun}
            onCreate={handleCreate}
          />
        </div>

        {optimisticItems.length === 0 ? (
          <Empty className="border border-dashed border-divider">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>No {itemNoun}s yet</EmptyTitle>
              <EmptyDescription>Use &ldquo;New {itemNoun}&rdquo; above to add the first one.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : resolvedView === "board" ? (
          <PipelineBoard
            columns={board.columns}
            items={filteredItems}
            progressByItem={progressByItem}
            onSelect={setSelectedId}
            onMoveStage={handleMoveStage}
          />
        ) : (
          <PipelineListView columns={board.columns} items={filteredItems} progressByItem={progressByItem} onSelect={setSelectedId} />
        )}
      </div>

      <PipelineItemDetail
        item={selected}
        columns={board.columns}
        activities={activities}
        lookups={lookups}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onMoveStage={handleMoveStage}
      />
    </div>
  );
}
