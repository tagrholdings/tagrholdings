"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { VaultInput } from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import type { PipelineBoardRow } from "@/components/pipeline/types";
import type { UpdateBoardColumns } from "@/modules/pipeline/pipeline.types";

const MAX_STAGES = 10;

interface Row {
  /** Stable React key; `id` is the stage's real id and is absent on a stage added in this editor. */
  key: string;
  id?: string;
  label: string;
}

function StageIconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * Rename, reorder, add and remove a project's stages. A stage keeps its id however it is renamed or moved, so its cards
 * stay in it. Removing a stage that still has cards asks where they should go (they move when you save).
 * Nothing is applied until "Save stages"; the parent resolves `onSave` on success and rejects on failure.
 */
export function EditStagesForm({
  board,
  stageCounts,
  onSave,
  onCancel,
}: {
  board: PipelineBoardRow;
  /** Cards per stage id, for this board. */
  stageCounts: Record<string, number>;
  onSave: (input: Pick<UpdateBoardColumns, "columns" | "moveRemovedTo">) => Promise<void>;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => board.columns.map((c) => ({ key: c.id, id: c.id, label: c.label })));
  const [moveTo, setMoveTo] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const keptIds = new Set(rows.flatMap((r) => (r.id ? [r.id] : [])));
  const removed = board.columns.filter((c) => !keptIds.has(c.id));
  const orphaned = removed.reduce((sum, c) => sum + (stageCounts[c.id] ?? 0), 0);
  const keptExisting = rows.filter((r) => r.id);
  // The destination: the one picked if it is still kept, else the first kept existing stage.
  const destination = keptExisting.find((r) => r.id === moveTo)?.id ?? keptExisting[0]?.id;
  const cannotMove = orphaned > 0 && keptExisting.length === 0;

  const update = (key: string, label: string) => setRows((current) => current.map((r) => (r.key === key ? { ...r, label } : r)));
  const remove = (key: string) => setRows((current) => current.filter((r) => r.key !== key));
  const move = (index: number, by: -1 | 1) =>
    setRows((current) => {
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const add = () => setRows((current) => [...current, { key: `new-${crypto.randomUUID()}`, label: "" }]);

  async function save() {
    if (rows.some((r) => r.label.trim().length === 0)) {
      notify.error("Name every stage, or remove the empty ones.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        columns: rows.map((r) => ({ id: r.id, label: r.label.trim() })),
        moveRemovedTo: orphaned > 0 ? destination : undefined,
      });
    } catch {
      // The parent already showed the reason; stay open so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Stages of {board.name}</p>

      <ul className="space-y-2">
        {rows.map((row, index) => {
          const count = row.id ? (stageCounts[row.id] ?? 0) : 0;
          return (
            <li key={row.key} className="flex items-center gap-1">
              <VaultInput
                value={row.label}
                onChange={(e) => update(row.key, e.target.value)}
                placeholder={`Stage ${index + 1}`}
                aria-label={`Stage ${index + 1} name`}
                maxLength={60}
                className="h-9 min-w-0 flex-1"
              />
              {count > 0 && (
                <span className="shrink-0 px-1 text-xs text-muted-foreground" title={`${count} card${count === 1 ? "" : "s"} in this stage`}>
                  {count}
                </span>
              )}
              <StageIconButton label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                <ArrowUp className="size-4" />
              </StageIconButton>
              <StageIconButton label="Move down" onClick={() => move(index, 1)} disabled={index === rows.length - 1}>
                <ArrowDown className="size-4" />
              </StageIconButton>
              <StageIconButton label="Remove stage" onClick={() => remove(row.key)} disabled={rows.length <= 1}>
                <X className="size-4" />
              </StageIconButton>
            </li>
          );
        })}
      </ul>

      {rows.length < MAX_STAGES && (
        <button type="button" onClick={add} className="flex items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover">
          <Plus className="size-4" />
          Add stage
        </button>
      )}

      {orphaned > 0 && (
        <div className="space-y-2 rounded-md border border-divider bg-surface p-3 text-sm">
          <p className="text-foreground">
            {orphaned} card{orphaned === 1 ? "" : "s"} {orphaned === 1 ? "is" : "are"} in {removed.length === 1 ? "the stage" : "the stages"} you removed (
            {removed.map((c) => c.label).join(", ")}).
          </p>
          {cannotMove ? (
            <p className="text-destructive">Keep at least one existing stage so the cards have somewhere to go.</p>
          ) : (
            <label className="flex flex-wrap items-center gap-2 text-muted-foreground">
              Move {orphaned === 1 ? "it" : "them"} to
              <select
                value={destination}
                onChange={(e) => setMoveTo(e.target.value)}
                className="h-9 min-w-0 rounded-md border border-divider bg-background px-2 text-sm text-foreground"
              >
                {keptExisting.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label.trim() || "(unnamed)"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} loading={saving} disabled={cannotMove}>
          Save stages
        </Button>
      </div>
    </div>
  );
}
