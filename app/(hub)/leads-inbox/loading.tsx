import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

// Column-shaped to match the Board default (design.md's "loading states —
// always skeleton").
export default function LeadsInboxLoading() {
  return (
    <HubLoading>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-16 rounded-pill" />
        <Skeleton className="h-9 w-24 rounded-pill" />
        <Skeleton className="h-9 w-20" />
      </div>
      {/* overflow-hidden, not overflow-x-auto like the real board — a
          skeleton has nothing to scroll to, so a horizontal scrollbar here
          would just be decorative chrome with no purpose. Columns that don't
          fit are clipped instead. */}
      <div className="flex flex-1 gap-4 overflow-hidden pb-2">
        {Array.from({ length: 6 }).map((_, columnIndex) => (
          <div key={columnIndex} className="flex w-[250px] shrink-0 flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 4 }).map((_, cardIndex) => (
              <Skeleton key={cardIndex} className="h-20 w-full" />
            ))}
          </div>
        ))}
      </div>
    </HubLoading>
  );
}
