"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Check, Pencil, Settings2, Trash2, X } from "lucide-react";
import { Vault, VaultTrigger, VaultContent, VaultHeader, VaultTitle, VaultDescription, VaultInput } from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineBoardRow } from "@/components/pipeline/types";

interface ManageProjectsVaultProps {
  boards: PipelineBoardRow[];
  itemCounts: Record<string, number>;
  onRename: (id: string, name: string) => void;
  onSetArchived: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}

function IconButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted",
        destructive ? "hover:text-destructive" : "hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ProjectRow({
  board,
  itemCount,
  onRename,
  onSetArchived,
  onDelete,
}: {
  board: PipelineBoardRow;
  itemCount: number;
} & Omit<ManageProjectsVaultProps, "boards" | "itemCounts">) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm-delete">("view");
  const [draft, setDraft] = useState(board.name);
  const archived = !!board.archivedAt;
  const pending = board.id.startsWith("optimistic-");

  function saveRename() {
    const name = draft.trim();
    if (name && name !== board.name) onRename(board.id, name);
    setMode("view");
  }

  if (mode === "confirm-delete") {
    return (
      <li className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <p className="text-sm text-foreground">
          Delete <strong>{board.name}</strong>
          {itemCount > 0 && ` and its ${itemCount} item${itemCount === 1 ? "" : "s"}`}? This can&rsquo;t be undone. Linked
          activities are kept on the Activities page.
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(board.id)}>
            <Trash2 />
            Delete project
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className={cn("flex items-center gap-2 rounded-lg border border-divider bg-background px-3 py-2", pending && "opacity-60")}>
      {mode === "rename" ? (
        <>
          <VaultInput
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveRename();
              }
              if (e.key === "Escape") setMode("view");
            }}
            className="h-9 flex-1"
          />
          <IconButton label="Save name" onClick={saveRename}>
            <Check className="size-4" />
          </IconButton>
          <IconButton label="Cancel rename" onClick={() => setMode("view")}>
            <X className="size-4" />
          </IconButton>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm font-medium", archived ? "text-muted-foreground" : "text-foreground")}>
              {board.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {itemCount} item{itemCount === 1 ? "" : "s"} · {board.columns.length} stage{board.columns.length === 1 ? "" : "s"}
              {archived && " · Archived"}
            </p>
          </div>
          {!pending && (
            <>
              <IconButton
                label="Rename"
                onClick={() => {
                  setDraft(board.name);
                  setMode("rename");
                }}
              >
                <Pencil className="size-4" />
              </IconButton>
              <IconButton label={archived ? "Restore" : "Archive"} onClick={() => onSetArchived(board.id, !archived)}>
                {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              </IconButton>
              <IconButton label="Delete" destructive onClick={() => setMode("confirm-delete")}>
                <Trash2 className="size-4" />
              </IconButton>
            </>
          )}
        </>
      )}
    </li>
  );
}

/** Rename, archive/restore and delete projects — every change applies optimistically. */
export function ManageProjectsVault({ boards, itemCounts, onRename, onSetArchived, onDelete }: ManageProjectsVaultProps) {
  const active = boards.filter((b) => !b.archivedAt);
  const archived = boards.filter((b) => b.archivedAt);

  const renderRow = (board: PipelineBoardRow) => (
    <ProjectRow
      key={board.id}
      board={board}
      itemCount={itemCounts[board.id] ?? 0}
      onRename={onRename}
      onSetArchived={onSetArchived}
      onDelete={onDelete}
    />
  );

  return (
    <Vault>
      <VaultTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
          Manage
        </button>
      </VaultTrigger>
      <VaultContent aria-label="Manage projects">
        <VaultHeader>
          <VaultTitle>Manage projects</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">
          Archiving hides a project&rsquo;s tab but keeps everything in it. Deleting removes the project and its items for good.
        </VaultDescription>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="label-kicker">Active</p>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            ) : (
              <ul className="space-y-2">{active.map(renderRow)}</ul>
            )}
          </div>

          {archived.length > 0 && (
            <div className="space-y-2">
              <p className="label-kicker">Archived</p>
              <ul className="space-y-2">{archived.map(renderRow)}</ul>
            </div>
          )}
        </div>
      </VaultContent>
    </Vault>
  );
}
