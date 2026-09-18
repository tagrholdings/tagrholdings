"use client";

import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { columnDotClassName } from "@/modules/pipeline/pipeline.constants";
import { cn } from "@/lib/utils";
import { PipelineCard } from "./PipelineCard";
import type { ActivityProgress, PipelineItemRow, BoardColumn } from "./types";

interface PipelineBoardProps {
  columns: BoardColumn[];
  items: PipelineItemRow[];
  progressByItem: Record<string, ActivityProgress>;
  onSelect: (id: string) => void;
  onMoveStage: (id: string, stage: string) => void;
}

function DraggableCard({
  item,
  progress,
  onSelect,
}: {
  item: PipelineItemRow;
  progress?: ActivityProgress;
  onSelect: (id: string) => void;
}) {
  // An optimistic card has no real id yet — nothing to move or open until the server confirms it.
  const disabled = item.id.startsWith("optimistic-");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, disabled });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => !disabled && onSelect(item.id)}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("block w-full cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")}
      {...listeners}
      {...attributes}
    >
      <PipelineCard item={item} progress={progress} />
    </button>
  );
}

function Column({
  column,
  dotClassName,
  items,
  progressByItem,
  onSelect,
}: {
  column: BoardColumn;
  dotClassName: string;
  items: PipelineItemRow[];
  progressByItem: Record<string, ActivityProgress>;
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex w-[250px] shrink-0 flex-col bg-surface/50 rounded-lg p-2">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", dotClassName)} />
        <h3 className="font-serif text-xs font-semibold uppercase tracking-wide text-foreground">{column.label}</h3>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-dashed border-transparent p-1 transition-colors",
          isOver && "border-accent/50 bg-accent/5"
        )}
      >
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} progress={progressByItem[item.id]} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function PipelineBoard({ columns, items, progressByItem, onSelect, onMoveStage }: PipelineBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const item = items.find((i) => i.id === active.id);
    if (!item || item.stage === over.id) return;
    onMoveStage(String(active.id), String(over.id));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-scroll flex flex-1 gap-4 overflow-x-auto pb-2">
        {columns.map((column, index) => (
          <Column
            key={column.id}
            column={column}
            dotClassName={columnDotClassName(index)}
            items={items.filter((item) => item.stage === column.id)}
            progressByItem={progressByItem}
            onSelect={onSelect}
          />
        ))}
      </div>
    </DndContext>
  );
}
