import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LinkTab<Id extends string = string> {
  id: Id;
  label: string;
  href: string;
}

/**
 * Sub-navigation as real links (each tab is its own route with its own server data), styled like
 * SegmentedControl — so it stays a Server Component. Labels never wrap: when the tabs don't fit the
 * screen the strip scrolls sideways instead of squeezing them into two-line pills.
 */
export function LinkTabs<Id extends string>({
  label,
  tabs,
  active,
  tourId,
}: {
  label: string;
  tabs: readonly LinkTab<Id>[];
  active: Id;
  /** `data-tour` name, so a guided tour can point at this particular tab strip (see components/layout/page-help.ts). */
  tourId?: string;
}) {
  return (
    <nav aria-label={label} data-tour={tourId} className="no-scrollbar -mb-2 flex max-w-full overflow-x-auto">
      <div className="inline-flex h-9 shrink-0 items-center rounded-md border border-divider bg-surface p-0.5">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
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
  );
}
