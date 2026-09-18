"use client";

import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSameDate, type WeekDay } from "@/utils/date";
import type { ActivityRow } from "@/modules/activities/activities.types";

export type WeekDateField = "dueDate" | "createdAt";

function WeekActivityCard({ activity, onSelect }: { activity: ActivityRow; onSelect: (id: string) => void }) {
  const disabled = activity.id.startsWith("optimistic-");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: activity.id, disabled });
  const context = activity.pipelineItemTitle ?? activity.contactName ?? activity.organizationName;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => !disabled && onSelect(activity.id)}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "flex min-h-[64px] w-full shrink-0 cursor-grab touch-none items-start gap-2 rounded-md border border-divider bg-surface p-3 text-left active:cursor-grabbing",
        activity.priority === "high" && !activity.done && "border-l-2 border-l-destructive",
        (isDragging || disabled) && "opacity-40"
      )}
      {...listeners}
      {...attributes}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          activity.done ? "border-accent bg-accent text-ink" : "border-divider"
        )}
      >
        {activity.done && <CheckSquare className="size-3" />}
      </span>
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", activity.done ? "text-muted-foreground line-through" : "text-foreground")}>
          {activity.subject}
        </p>
        {context && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            {activity.pipelineItemTitle && <Link2 className="size-3 shrink-0" />}
            <span className="truncate">{context}</span>
          </p>
        )}
      </div>
    </button>
  );
}

function DayColumn({
  day,
  activities,
  onSelect,
}: {
  day: WeekDay;
  activities: ActivityRow[];
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.date.toISOString() });

  return (
    <div className="flex w-[220px] shrink-0 flex-col bg-surface/50 rounded-lg p-2">
      <div className="mb-3 flex items-center gap-2 px-1">
        <h3 className={cn("font-serif text-xs font-semibold uppercase tracking-wide", day.isToday ? "text-accent" : "text-foreground")}>
          {day.label} {day.dayNumber}
        </h3>
        <span className="text-xs text-muted-foreground">{activities.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-dashed border-transparent p-1 transition-colors",
          isOver && "border-accent/50 bg-accent/5"
        )}
      >
        {activities.map((activity) => (
          <WeekActivityCard key={activity.id} activity={activity} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function WeekBoard({
  days,
  activities,
  dateField,
  onSelect,
  onMoveToDay,
}: {
  days: WeekDay[];
  activities: ActivityRow[];
  dateField: WeekDateField;
  onSelect: (id: string) => void;
  onMoveToDay: (id: string, date: Date) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activity = activities.find((a) => a.id === active.id);
    const targetDay = days.find((d) => d.date.toISOString() === over.id);
    if (!activity || !targetDay) return;

    const current = activity[dateField];
    if (current && isSameDate(current, targetDay.date)) return;

    // Keep the original time-of-day, just move the calendar day — a local
    // Date, never `new Date(isoString)` (see utils/date.ts's note on why).
    const source = current ? new Date(current) : new Date();
    const moved = new Date(
      targetDay.date.getFullYear(),
      targetDay.date.getMonth(),
      targetDay.date.getDate(),
      source.getHours(),
      source.getMinutes()
    );
    onMoveToDay(activity.id, moved);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-scroll flex flex-1 gap-4 overflow-x-auto pb-2">
        {days.map((day) => (
          <DayColumn
            key={day.label}
            day={day}
            activities={activities.filter((a) => a[dateField] && isSameDate(a[dateField]!, day.date))}
            onSelect={onSelect}
          />
        ))}
      </div>
    </DndContext>
  );
}
