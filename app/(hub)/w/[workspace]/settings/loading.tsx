import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

/** Fallback for the Settings tabs that don't have their own (Engine spend); Notifications has its own. */
export default function SettingsLoading() {
  return (
    <HubLoading>
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full flex-1" />
    </HubLoading>
  );
}
