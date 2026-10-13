import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

// Shared by every EOS page (Vision, People, Process): a toolbar row, then one bordered panel of rows (the grid/list every page opens on).
export default function EosLoading() {
  return (
    <HubLoading>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-56" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-36 rounded-pill" />
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-divider p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </HubLoading>
  );
}
