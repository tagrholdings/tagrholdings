"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Archive, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { PipelineView } from "@/components/pipeline/PipelineView";
import type { ActivityLookups } from "@/components/shared/activity-form";
import type { PipelineBoardRow, PipelineItemRow } from "@/components/pipeline/types";
import type { ActivityRow } from "@/modules/activities/activities.types";
import type { NewBoard } from "@/modules/pipeline/pipeline.types";
import {
  createBoardAction,
  deleteBoardAction,
  renameBoardAction,
  setBoardArchivedAction,
} from "@/modules/pipeline/pipeline.actions";
import { CreateProjectVault } from "./CreateProjectVault";
import { ManageProjectsVault } from "./ManageProjectsVault";

type Patch =
  | { kind: "add"; board: PipelineBoardRow }
  | { kind: "rename"; id: string; name: string }
  | { kind: "archive"; id: string; archived: boolean }
  | { kind: "delete"; id: string };

function applyPatch(state: PipelineBoardRow[], patch: Patch): PipelineBoardRow[] {
  switch (patch.kind) {
    case "add":
      return [...state, patch.board];
    case "rename":
      return state.map((b) => (b.id === patch.id ? { ...b, name: patch.name } : b));
    case "archive":
      return state.map((b) => (b.id === patch.id ? { ...b, archivedAt: patch.archived ? new Date() : null } : b));
    case "delete":
      return state.filter((b) => b.id !== patch.id);
  }
}

export function ProjectsView({
  boards: initialBoards,
  itemsByBoard,
  activities,
  lookups,
  initialBoardId,
  initialItemId,
}: {
  boards: PipelineBoardRow[];
  itemsByBoard: Record<string, PipelineItemRow[]>;
  activities: ActivityRow[];
  lookups: ActivityLookups;
  initialBoardId: string | null;
  initialItemId: string | null;
}) {
  const [boards, addPatch] = useOptimistic(initialBoards, applyPatch);
  const [, startTransition] = useTransition();
  const [showArchived, setShowArchived] = useState(
    () => !!initialBoardId && !!initialBoards.find((b) => b.id === initialBoardId)?.archivedAt
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialBoardId);

  const activeBoards = boards.filter((b) => !b.archivedAt);
  const archivedBoards = boards.filter((b) => b.archivedAt);
  const visibleBoards = showArchived ? [...activeBoards, ...archivedBoards] : activeBoards;
  // Falls back to the first tab when the selected project was archived/deleted (or never existed).
  const selectedBoard = visibleBoards.find((b) => b.id === selectedId) ?? visibleBoards[0] ?? null;

  /** Each mutation: patch optimistically, run the action, toast on failure (the patch then rolls back). */
  function run(patch: Patch, action: () => Promise<{ serverError?: string } | undefined>, failMessage: string) {
    startTransition(async () => {
      addPatch(patch);
      const result = await action();
      if (result?.serverError) notify.error(result.serverError ?? failMessage);
    });
  }

  function handleCreate(input: NewBoard) {
    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const tempId = `optimistic-${crypto.randomUUID()}`;
        addPatch({
          kind: "add",
          board: {
            id: tempId,
            name: input.name,
            columns: input.columns.map((c, i) => ({ id: `column_${i}`, label: c.label })),
            isSystem: false,
            archivedAt: null,
          },
        });
        setSelectedId(tempId);
        const result = await createBoardAction(input);
        if (result?.serverError || result?.validationErrors || !result?.data) {
          notify.error(result?.serverError ?? "Couldn't create that project. Please try again.");
          reject(new Error("createBoardAction failed"));
          return;
        }
        const realId = result.data.board.id;
        // Post-await updates need their own startTransition to commit together
        // with the revalidated board list (otherwise the tab briefly points nowhere).
        startTransition(() => setSelectedId(realId));
        resolve();
      });
    });
  }

  const manageVault = (
    <ManageProjectsVault
      boards={boards}
      itemCounts={Object.fromEntries(boards.map((b) => [b.id, itemsByBoard[b.id]?.length ?? 0]))}
      onRename={(id, name) =>
        run({ kind: "rename", id, name }, () => renameBoardAction({ id, name }), "Couldn't rename that project.")
      }
      onSetArchived={(id, archived) =>
        run({ kind: "archive", id, archived }, () => setBoardArchivedAction({ id, archived }), "Couldn't update that project.")
      }
      onDelete={(id) => run({ kind: "delete", id }, () => deleteBoardAction({ id }), "Couldn't delete that project.")}
    />
  );

  if (boards.length === 0) {
    return (
      <Empty className="border border-dashed border-divider">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanban />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>
            A project is a board with your own stages — e.g. &ldquo;Vendor onboarding: Contacted → Negotiating → Signed&rdquo;.
          </EmptyDescription>
        </EmptyHeader>
        <CreateProjectVault variant="button" onCreate={handleCreate} />
      </Empty>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {visibleBoards.map((board) => (
          <button
            key={board.id}
            type="button"
            onClick={() => setSelectedId(board.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
              selectedBoard?.id === board.id
                ? "border-accent bg-accent text-ink"
                : "border-divider bg-surface text-muted-foreground hover:text-foreground",
              board.archivedAt && "border-dashed",
              board.id.startsWith("optimistic-") && "opacity-60"
            )}
          >
            {board.archivedAt && <Archive className="size-3" />}
            {board.name}
          </button>
        ))}
        {archivedBoards.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="rounded-pill px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {showArchived ? "Hide archived" : `Show archived (${archivedBoards.length})`}
          </button>
        )}
        <CreateProjectVault variant="link" onCreate={handleCreate} />
        <div className="ml-auto">{manageVault}</div>
      </div>

      {selectedBoard ? (
        // key={board.id} forces a clean remount per board — each board's
        // items/columns are completely different data, and PipelineView owns
        // local state (search, view toggle, optimistic list) that shouldn't
        // carry over from the previous tab.
        <PipelineView
          key={selectedBoard.id}
          board={selectedBoard}
          items={itemsByBoard[selectedBoard.id] ?? []}
          activities={activities}
          lookups={lookups}
          itemNoun="item"
          initialSelectedId={selectedBoard.id === initialBoardId ? initialItemId : null}
        />
      ) : (
        <Empty className="border border-dashed border-divider">
          <EmptyHeader>
            <EmptyTitle>All projects are archived</EmptyTitle>
            <EmptyDescription>Show archived projects above, or restore one from &ldquo;Manage&rdquo;.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
