import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

// Day-column-shaped to match the week Board default (design.md's "loading
// states — always skeleton").
export default function ActivitiesLoading() {
  return (
    <HubLoading>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-36 rounded-pill" />
        <Skeleton className="h-9 w-40 rounded-pill" />
        <Skeleton className="h-9 w-16 rounded-pill" />
        <Skeleton className="h-9 w-16" />
      </div>
      <div className="flex flex-1 gap-4 overflow-hidden pb-2">
        {Array.from({ length: 7 }).map((_, columnIndex) => (
          <div key={columnIndex} className="flex w-[220px] shrink-0 flex-col gap-3">
            <Skeleton className="h-4 w-16" />
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <Skeleton key={cardIndex} className="h-16 w-full" />
            ))}
          </div>
        ))}
      </div>
    </HubLoading>
  );
}
