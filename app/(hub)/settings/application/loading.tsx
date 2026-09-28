import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function ApplicationSettingsLoading() {
  return (
    <HubLoading>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-36 w-full max-w-2xl" />
    </HubLoading>
  );
}
