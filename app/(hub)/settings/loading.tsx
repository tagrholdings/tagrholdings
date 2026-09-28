import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function EngineSpendLoading() {
  return (
    <HubLoading>
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full flex-1" />
    </HubLoading>
  );
}
