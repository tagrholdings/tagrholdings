import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function SearchProfilesLoading() {
  return (
    <HubLoading>
      <Skeleton className="h-9 w-72" />
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </HubLoading>
  );
}
