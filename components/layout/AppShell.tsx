"use client";

import * as React from "react";
import {
  Sidebar,
  type SidebarUser,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_INSET,
  SIDEBAR_GAP,
} from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { AppHeader, type AppHeaderAction } from "./AppHeader";
import { useSidebarCollapsed } from "@/hooks/ui/use-sidebar-collapsed";

const CONTENT_OFFSET_EXPANDED = SIDEBAR_WIDTH_EXPANDED + SIDEBAR_INSET + SIDEBAR_GAP;
const CONTENT_OFFSET_COLLAPSED = SIDEBAR_WIDTH_COLLAPSED + SIDEBAR_INSET + SIDEBAR_GAP;

interface AppShellProps {
  user: SidebarUser;
  /** Overrides the pathname match for nav highlighting — mainly for previews/tests. */
  activeHref?: string;
  badges?: Record<string, number>;
  kicker?: string;
  title: string;
  backHref?: string;
  showSearch?: boolean;
  primaryAction?: AppHeaderAction;
  onSignOut?: () => void;
  children: React.ReactNode;
}

/**
 * The one hub layout: Sidebar (desktop/tablet) + BottomNav (mobile/PWA) +
 * the adaptive AppHeader, wired to the shared nav config. Use this from a
 * route's page.tsx, passing server-fetched data down as `children`/props —
 * this component itself only renders chrome, never fetches data.
 */
export function AppShell({
  user,
  activeHref,
  badges,
  kicker,
  title,
  backHref,
  showSearch,
  primaryAction,
  onSignOut,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const contentOffset = collapsed ? CONTENT_OFFSET_COLLAPSED : CONTENT_OFFSET_EXPANDED;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        user={user}
        activeHref={activeHref}
        badges={badges}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
      />

      <div
        className="flex min-h-screen flex-col transition-[padding-left] duration-300 ease-in-out md:gap-4 md:pr-4 md:pl-[var(--sidebar-content-offset)]"
        style={{ "--sidebar-content-offset": `${contentOffset}px` } as React.CSSProperties}
      >
        <AppHeader
          kicker={kicker}
          title={title}
          backHref={backHref}
          showSearch={showSearch}
          primaryAction={primaryAction}
          user={user}
          onSignOut={onSignOut}
        />
        <main className="flex-1 space-y-6 px-4 py-6 pb-24 md:px-6 md:pt-0 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav activeHref={activeHref} badges={badges} />
    </div>
  );
}
