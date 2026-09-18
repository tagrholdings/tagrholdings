import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityProgress } from "./types";

/** "4/8" — how many of an item's linked activities are done. Renders nothing when there are none. */
export function ActivityProgressBadge({ progress, className }: { progress?: ActivityProgress; className?: string }) {
  if (!progress || progress.total === 0) return null;
  const complete = progress.done === progress.total;

  return (
    <span
      title={`${progress.done} of ${progress.total} activities done`}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        complete ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
        className
      )}
    >
      <ListChecks className="size-3" />
      {progress.done}/{progress.total}
    </span>
  );
}
