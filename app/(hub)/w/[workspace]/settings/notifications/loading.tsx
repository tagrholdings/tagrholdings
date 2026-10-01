import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function NotificationsSettingsLoading() {
  return (
    <HubLoading>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-28 w-full max-w-2xl" />
    </HubLoading>
  );
}
