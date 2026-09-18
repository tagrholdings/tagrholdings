import { cn, initialsFor } from "@/lib/utils";
import { ActivityProgressBadge } from "./ActivityProgressBadge";
import type { ActivityProgress, PipelineItemRow } from "./types";

export function PipelineCard({ item, progress }: { item: PipelineItemRow; progress?: ActivityProgress }) {
  const isOptimistic = item.id.startsWith("optimistic-");

  return (
    <div className={cn("rounded-md border border-divider bg-surface p-3 text-left", isOptimistic && "opacity-60")}>
      <p className="font-serif text-sm font-bold text-foreground">{item.title}</p>
      {item.organizationName && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.organizationName}</p>
      )}
      {(item.contactName || (progress && progress.total > 0)) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {item.contactName ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold text-foreground">
                {initialsFor(item.contactName)}
              </span>
              <span className="truncate text-xs text-muted-foreground">{item.contactName}</span>
            </div>
          ) : (
            <span />
          )}
          <ActivityProgressBadge progress={progress} className="shrink-0" />
        </div>
      )}
    </div>
  );
}
