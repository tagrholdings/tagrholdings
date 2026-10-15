import type { LucideIcon } from "lucide-react";
import { stripWorkspacePrefix } from "@/lib/workspace-path";
import { FolderKanban, Users, ListChecks, Radar, Target, LayoutDashboard, LineChart, Gem, CircleAlert, Timer, Compass, Network, Workflow, ClipboardList } from "lucide-react";

export interface NavItem {
  label: string;
  /** Workspace-relative ("/contacts") — render it with `workspacePath(slug, href)` / `useWorkspacePath()`. */
  href: string;
  icon: LucideIcon;
  /** Key into the `badges` map passed to Sidebar/BottomNav, e.g. unread counts. */
  badgeKey?: string;
  /** Active only on this exact path — for a section's landing page whose children have their own items (/traction). */
  exact?: boolean;
}

export type NavSectionId = "crm" | "traction" | "eos";

export interface NavSection {
  id: NavSectionId;
  label: string;
  items: NavItem[];
  /** The desktop Sidebar lets this section fold away under its label (the bottom nav shows one section at a time anyway). */
  collapsible?: boolean;
}

/**
 * The CRM half of the navigation. Ordered the way work flows: the engine's finds land in Sourcing → the ones worth
 * pursuing become leads → deals become projects → activities get it done → contacts tie it all together.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Sourcing", href: "/sourcing", icon: Radar, badgeKey: "leadsInboxUnread" },
  { label: "Leads", href: "/leads", icon: Target },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Activities", href: "/activities", icon: ListChecks },
  { label: "Contacts", href: "/contacts", icon: Users },
];

/** Traction — the EOS operating system (see .agents/docs/EOS_PLAN.md), in the order a week uses it. */
export const TRACTION_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/traction", icon: LayoutDashboard, exact: true },
  { label: "Scorecard", href: "/traction/scorecard", icon: LineChart },
  { label: "Rocks", href: "/traction/rocks", icon: Gem },
  { label: "Issues", href: "/traction/issues", icon: CircleAlert },
  { label: "L10s", href: "/traction/l10", icon: Timer },
];

/** EOS's long-lived components: where the company is going, who sits where, and how the work is done. */
export const EOS_NAV_ITEMS: NavItem[] = [
  { label: "Vision", href: "/eos/vision", icon: Compass },
  { label: "People", href: "/eos/people", icon: Network },
  { label: "Process", href: "/eos/process", icon: Workflow },
  { label: "Checkup", href: "/eos/checkup", icon: ClipboardList },
];

/**
 * Single source of truth for primary navigation — consumed by both Sidebar (desktop/tablet, every section stacked
 * under its label) and BottomNav (mobile/PWA, one section at a time; drag the bar down for the next one). See
 * .agents/rules/design.md — "Responsive navigation".
 */
export const NAV_SECTIONS: NavSection[] = [
  { id: "crm", label: "CRM", items: NAV_ITEMS },
  { id: "traction", label: "Traction", items: TRACTION_NAV_ITEMS, collapsible: true },
  { id: "eos", label: "EOS", items: EOS_NAV_ITEMS, collapsible: true },
];

/** Bottom nav shows the first N items as tabs; the rest collapse into "More". */
export const BOTTOM_NAV_MAX_PRIMARY = 5;

/** `itemHref` is workspace-relative ("/contacts"); `currentHref` may be the full `/w/<slug>/contacts/12` — the prefix is ignored. */
export function isNavItemActive(currentHref: string | undefined | null, itemHref: string, exact = false) {
  if (!currentHref) return false;
  const path = stripWorkspacePrefix(currentHref).replace(/\/+$/, "") || "/";
  return path === itemHref || (!exact && path.startsWith(`${itemHref}/`));
}

/** Which section a page belongs to — the one the bottom nav shows when you land on it. */
export function sectionForPath(currentHref: string | undefined | null): NavSectionId {
  const section = NAV_SECTIONS.find((s) => s.items.some((item) => isNavItemActive(currentHref, item.href, item.exact)));
  return section?.id ?? "crm";
}
