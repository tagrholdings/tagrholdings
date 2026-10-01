"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import { PageSlot } from "@/components/layout/page-slots";

export interface LinkTab<Id extends string = string> {
  id: Id;
  label: string;
  href: string;
}

/**
 * Sub-navigation as real links (each tab is its own route with its own server data), styled like
 * SegmentedControl. `href`s are workspace-relative ("/settings/inbox"); the current workspace is added here. Labels never wrap: when the tabs don't fit the
 * screen the strip scrolls sideways instead of squeezing them into two-line pills.
 */
export function LinkTabs<Id extends string>({
  label,
  tabs,
  active,
  tourId,
  mobileSticky,
}: {
  label: string;
  tabs: readonly LinkTab<Id>[];
  active: Id;
  /** `data-tour` name, so a guided tour can point at this particular tab strip (see components/layout/page-help.ts). */
  tourId?: string;
  /**
   * Pins the strip under the mobile header (same `top-14` offset as the toolbars beneath it) and centers it there — for a short tab list that's a page's main sub-navigation. Desktop is unaffected.
   * It also gives the page a place on phones, beside the strip, for its own "add" button (a view sends it with
   * `<PageSlotContent name="tabs">`, see page-slots.tsx) so the button doesn't need a row of its own.
   */
  mobileSticky?: boolean;
}) {
  const path = useWorkspacePath();
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 -mb-2",
        mobileSticky && "sticky top-14 z-10 bg-background py-2.5 md:static md:bg-transparent md:py-0"
      )}
    >
      <nav
        aria-label={label}
        data-tour={tourId}
        // min-w-0 lets this shrink inside its flex parent (a flex item's width otherwise defaults to its
        // content's intrinsic size) — without it the tab strip pushes the page wider instead of scrolling in place.
        className={cn("no-scrollbar flex min-w-0 overflow-x-auto", mobileSticky ? "flex-1 md:flex-initial" : "flex-1")}
      >
        <div className="inline-flex h-9 shrink-0 items-center rounded-md border border-divider bg-surface p-0.5">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={path(tab.href)}
              aria-current={tab.id === active ? "page" : undefined}
              className={cn(
                "flex h-full shrink-0 items-center whitespace-nowrap rounded-sm px-2.5 text-xs font-medium transition-colors sm:px-3",
                tab.id === active ? "bg-accent text-ink" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
      {mobileSticky && <PageSlot name="tabs" className="shrink-0" />}
    </div>
  );
}
