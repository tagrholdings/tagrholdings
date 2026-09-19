import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function EmailSourcesLoading() {
  return (
    <HubLoading>
      <Skeleton className="h-9 w-96" />
      <Skeleton className="h-28 w-full" />
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </HubLoading>
  );
}
