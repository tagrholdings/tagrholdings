import { Skeleton } from "@/components/ui/skeleton";
import { HubLoading } from "@/components/layout/HubLoading";

export default function DocsLoading() {
  return (
    <HubLoading>
      <div className="flex flex-col gap-6 lg:flex-row">
        <Skeleton className="h-48 w-full lg:w-56" />
        <div className="flex flex-1 flex-col gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      </div>
    </HubLoading>
  );
}
