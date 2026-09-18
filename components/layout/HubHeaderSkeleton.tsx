import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stand-in for AppHeader while a route's loading.tsx is showing — the real
 * AppHeader needs the user, which loading.tsx (no data fetching) can't
 * provide. Mirrors AppHeader's own mobile/desktop dual-render + exact
 * spacing/position classes (sticky, height, padding, border) so nothing
 * shifts when the real header mounts in its place. Sidebar/BottomNav don't
 * need this treatment — app/(hub)/layout.tsx renders them once and they
 * persist across the navigation instead of unmounting.
 */
export function HubHeaderSkeleton() {
  return (
    <>
      <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-divider bg-background px-4 md:hidden">
        <div className="size-1" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="size-9 shrink-0 rounded-full" />
      </div>
      <div className="sticky top-4 z-20 hidden h-16 shrink-0 items-center gap-4 rounded-lg px-6 md:flex">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="size-9 shrink-0 rounded-full" />
      </div>
    </>
  );
}
