"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { OwnerBadge } from "@/components/traction/traction-ui";
import { ActivityProgressBadge } from "@/components/pipeline/ActivityProgressBadge";
import type { ActivityProgress } from "@/components/pipeline/types";
import { ROCK_STATUS_LABELS, type RockRow, type RockStatus, type TractionMember } from "@/modules/traction/traction.types";

type BoardStatus = Exclude<RockStatus, "rolled_over">;

const COLUMNS: { status: BoardStatus; dot: string }[] = [
  { status: "on_track", dot: "bg-accent" },
  { status: "off_track", dot: "bg-destructive" },
  { status: "complete", dot: "bg-success" },
  { status: "dropped", dot: "bg-muted-foreground" },
];

function RockCard({
  rock,
  members,
  progress,
  draggable,
  onSelect,
}: {
  rock: RockRow;
  members: TractionMember[];
  progress?: ActivityProgress;
  draggable: boolean;
  onSelect: (rock: RockRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: rock.id, disabled: !draggable });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(rock)}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "block w-full rounded-lg border border-divider bg-surface p-3 text-left transition-colors hover:border-accent/50",
        draggable && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      {...listeners}
      {...attributes}
    >
      <span className={cn("block text-sm font-medium text-foreground", rock.status === "dropped" && "text-muted-foreground line-through")}>{rock.title}</span>
      {rock.successCriteria && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">Done when: {rock.successCriteria}</span>}
      <span className="mt-2 flex flex-wrap items-center gap-2">
        <OwnerBadge members={members} userId={rock.ownerPersonId} />
        {!rock.isCompany && <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Individual</span>}
        <ActivityProgressBadge progress={progress} />
        {rock.dueDate && (
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {formatDateUS(new Date(`${rock.dueDate}T12:00:00`), { month: "short", day: "numeric" })}
          </span>
        )}
      </span>
    </button>
  );
}

function Column({ status, dot, children, count }: { status: BoardStatus; dot: string; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-[260px] shrink-0 flex-col rounded-lg bg-surface/50 p-2">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", dot)} />
        <h3 className="font-serif text-xs font-semibold uppercase tracking-wide text-foreground">{ROCK_STATUS_LABELS[status]}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div ref={setNodeRef} className={cn("flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-dashed border-transparent p-1 transition-colors", isOver && "border-accent/50 bg-accent/5")}>
        {children}
      </div>
    </div>
  );
}

/**
 * The quarter's Rocks as a kanban by status — drag a card to change it. A finished quarter is read-only here:
 * its Rocks are closed out (complete / carry / drop) from the list view, since EOS gives no partial credit.
 */
export function RocksBoard({
  rocks,
  members,
  progressByRock,
  readOnly,
  onSelect,
  onMove,
}: {
  rocks: RockRow[];
  members: TractionMember[];
  progressByRock: Record<string, ActivityProgress>;
  readOnly: boolean;
  onSelect: (rock: RockRow) => void;
  onMove: (rock: RockRow, status: BoardStatus) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    const rock = rocks.find((r) => r.id === event.active.id);
    const status = event.over.id as BoardStatus;
    if (rock && rock.status !== status) onMove(rock, status);
  }

  // A rolled-over Rock is history — its copy lives in the next quarter.
  const onBoard = rocks.filter((r) => r.status !== "rolled_over");
  return (
    // Fixed id: keeps dnd-kit's aria ids stable between server and client (see PipelineBoard).
    <DndContext id="rocks-board-dnd" sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-scroll flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map(({ status, dot }) => {
          const inColumn = onBoard.filter((r) => r.status === status);
          return (
            <Column key={status} status={status} dot={dot} count={inColumn.length}>
              {inColumn.map((rock) => (
                <RockCard key={rock.id} rock={rock} members={members} progress={progressByRock[rock.id]} draggable={!readOnly} onSelect={onSelect} />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}
