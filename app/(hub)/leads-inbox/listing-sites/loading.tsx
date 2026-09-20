import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function ListingSitesLoading() {
  return (
    <HubLoading>
      <Skeleton className="h-9 w-[28rem] max-w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </HubLoading>
  );
}
