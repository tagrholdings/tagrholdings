import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "inbox", label: "Inbox", href: "/leads-inbox" },
  { id: "profiles", label: "Search profiles", href: "/leads-inbox/profiles" },
  { id: "listing-sites", label: "Listing sites", href: "/leads-inbox/listing-sites" },
  { id: "email-sources", label: "Email sources", href: "/leads-inbox/email-sources" },
  { id: "spend", label: "Engine spend", href: "/leads-inbox/spend" },
] as const;

export type LeadsInboxTab = (typeof TABS)[number]["id"];

/**
 * Sub-navigation for the lead engine's screens. Same look as
 * SegmentedControl, but real links (each tab is its own route with its own
 * server data), so it stays a Server Component.
 */
export function LeadsInboxTabs({ active }: { active: LeadsInboxTab }) {
  return (
    <nav aria-label="Lead engine" className="-mb-2 flex max-w-full overflow-x-auto">
      <div className="inline-flex h-9 items-center rounded-md border border-divider bg-surface p-0.5">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === active ? "page" : undefined}
            className={cn(
              "flex h-full items-center rounded-sm px-3 text-xs font-medium transition-colors",
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
