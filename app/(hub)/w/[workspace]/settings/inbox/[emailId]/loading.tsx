import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function ReceivedEmailLoading() {
  return (
    <HubLoading>
      <div className="flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </HubLoading>
  );
}
