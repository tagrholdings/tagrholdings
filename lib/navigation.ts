import type { LucideIcon } from "lucide-react";
import { stripWorkspacePrefix } from "@/lib/workspace-path";
import { FolderKanban, Users, ListChecks, Inbox, Target, Zap, BookOpen } from "lucide-react";

export interface NavItem {
  label: string;
  /** Workspace-relative ("/contacts") — render it with `workspacePath(slug, href)` / `useWorkspacePath()`. */
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
  // Ordered the way work flows: the engine's finds land in the inbox → the
  // ones worth pursuing become leads → deals become projects → activities get
  // it done → contacts tie it all together.
  { label: "Leads Inbox", href: "/leads-inbox", icon: Inbox, badgeKey: "leadsInboxUnread" },
  { label: "Leads", href: "/leads", icon: Target },
  { label: "Projects", href: "/pipeline", icon: FolderKanban },
  { label: "Activities", href: "/activities", icon: ListChecks },
  { label: "Contacts", href: "/contacts", icon: Users },
  //{ label: "Automations", href: "/automations", icon: Zap },
];

/** Bottom nav shows the first N items as tabs; the rest collapse into "More". */
export const BOTTOM_NAV_MAX_PRIMARY = 5;

/** `itemHref` is workspace-relative ("/contacts"); `currentHref` may be the full `/w/<slug>/contacts/12` — the prefix is ignored. */
export function isNavItemActive(currentHref: string | undefined | null, itemHref: string) {
  if (!currentHref) return false;
  const path = stripWorkspacePrefix(currentHref);
  return path === itemHref || path.startsWith(`${itemHref}/`);
}
