import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function ContactsLoading() {
  return (
    <HubLoading>
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </HubLoading>
  );
}
