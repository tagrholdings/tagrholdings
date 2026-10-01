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
import { PushSoundListener } from "@/components/notifications/PushSoundListener";
import { useSidebarCollapsed } from "@/hooks/ui/use-sidebar-collapsed";
import { LAST_WORKSPACE_COOKIE } from "@/lib/last-workspace-cookie";
import { WorkspaceProvider, type WorkspaceContextValue } from "./workspace-context";

const CONTENT_OFFSET_EXPANDED = SIDEBAR_WIDTH_EXPANDED + SIDEBAR_INSET + SIDEBAR_GAP;
const CONTENT_OFFSET_COLLAPSED = SIDEBAR_WIDTH_COLLAPSED + SIDEBAR_INSET + SIDEBAR_GAP;

interface HubChromeProps {
  user: SidebarUser;
  workspace: WorkspaceContextValue;
  activeHref?: string;
  badges?: Record<string, number>;
  children: React.ReactNode;
}

/**
 * The persistent half of the hub shell — Sidebar + BottomNav + the content
 * column's sidebar-offset — rendered once by `app/(hub)/layout.tsx` so it
 * survives route changes instead of being torn down and remounted by every
 * page.tsx (which is what happened when this lived inside the old
 * `AppShell`, called fresh from each page). `AppHeader` + `main` are *not*
 * here — those still render per-page via `HubPage.tsx`, since title/kicker/
 * primaryAction genuinely differ per route and App Router layouts can't
 * receive props from the page below them.
 */
export function HubChrome({ user, workspace, activeHref, badges, children }: HubChromeProps) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  // Remember this workspace so `/` (and the installed app's launch) reopens it. Only a redirect hint — never authorization.
  React.useEffect(() => {
    document.cookie = `${LAST_WORKSPACE_COOKIE}=${encodeURIComponent(workspace.slug)}; path=/; max-age=31536000; samesite=lax`;
  }, [workspace.slug]);
  const contentOffset = collapsed ? CONTENT_OFFSET_COLLAPSED : CONTENT_OFFSET_EXPANDED;

  return (
    <WorkspaceProvider value={workspace}>
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
        {children}
      </div>

      <BottomNav activeHref={activeHref} badges={badges} />
      <PushSoundListener />
    </div>
    </WorkspaceProvider>
  );
}
