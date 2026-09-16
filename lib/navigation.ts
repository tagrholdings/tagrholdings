import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Users, ListChecks, Inbox, Zap } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Key into the `badges` map passed to Sidebar/BottomNav, e.g. unread counts. */
  badgeKey?: string;
}

/**
 * Single source of truth for primary navigation — consumed by both Sidebar
 * (desktop/tablet) and BottomNav (mobile/PWA) so the two renderings can
 * never drift apart. See .agents/rules/design.md — "Responsive navigation".
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Pipeline", href: "/pipeline", icon: LayoutGrid },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Activities", href: "/activities", icon: ListChecks },
  { label: "Leads Inbox", href: "/leads-inbox", icon: Inbox, badgeKey: "leadsInboxUnread" },
  { label: "Automations", href: "/automations", icon: Zap },
];

/** Bottom nav shows the first N items as tabs; the rest collapse into "More". */
export const BOTTOM_NAV_MAX_PRIMARY = 4;

export function isNavItemActive(currentHref: string | undefined | null, itemHref: string) {
  if (!currentHref) return false;
  return currentHref === itemHref || currentHref.startsWith(`${itemHref}/`);
}
