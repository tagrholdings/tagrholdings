"use client";

import * as React from "react";
import { Sidebar, type SidebarUser } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { AppHeader, type AppHeaderAction } from "./AppHeader";

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
  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} activeHref={activeHref} badges={badges} />

      <div className="flex min-h-screen flex-col md:pl-[248px]">
        <AppHeader
          kicker={kicker}
          title={title}
          backHref={backHref}
          showSearch={showSearch}
          primaryAction={primaryAction}
          user={user}
          onSignOut={onSignOut}
        />
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav activeHref={activeHref} badges={badges} />
    </div>
  );
}
