import { HubHeaderSkeleton } from "./HubHeaderSkeleton";

/**
 * The standard shape every route's loading.tsx renders: HubHeaderSkeleton +
 * a full-height body slot for that route's own content-shaped skeleton
 * (columns, rows, whatever matches its real layout — see design.md's
 * "Loading states"). Returns a Fragment with the header and body as two
 * *separate* children — matching HubPage's own `<><AppHeader/><main/></>`
 * structure exactly, because HubChrome's content column applies `md:gap-4`
 * between its direct children. Wrapping both in a single outer `<div>` (an
 * earlier version of this did) makes them one child instead of two, so that
 * gap silently doesn't apply and the header/body crowd together with no
 * spacing — looked like overlapping content. `flex-1` on the body is what
 * makes it fill the remaining page height.
 */
export function HubLoading({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubHeaderSkeleton />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 pb-24 md:px-6 md:pt-0 md:pb-8">{children}</div>
    </>
  );
}
