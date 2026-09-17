"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavItemActive } from "@/lib/navigation";

export interface SidebarUser {
  name: string;
  initials: string;
}

interface SidebarProps {
  user: SidebarUser;
  /** Overrides the pathname match — mainly for previews/tests. */
  activeHref?: string;
  badges?: Record<string, number>;
  /**
   * "responsive" (default): fixed to the viewport, hidden below md — the
   * real app behavior. "static": always visible, positioned absolute
   * within a `relative` ancestor — only for previews embedded in a
   * fixed-size frame, where the real viewport width can't be trusted.
   */
  variant?: "responsive" | "static";
  className?: string;
}

export function Sidebar({ user, activeHref, badges, variant = "responsive", className }: SidebarProps) {
  const pathname = usePathname();
  const currentHref = activeHref ?? pathname;

  return (
    <aside
      className={cn(
        "top-4 bottom-4 left-4 z-30 flex w-[216px] flex-col rounded-lg bg-sidebar text-sidebar-foreground shadow-md",
        variant === "responsive" ? "fixed hidden md:flex" : "absolute",
        className
      )}
    >
      <div className="px-5 py-6">
        <span className="font-serif text-lg font-semibold">TAGR</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(currentHref, item.href);
          const badgeCount = item.badgeKey ? badges?.[item.badgeKey] : undefined;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "text-accent font-medium"
                  : "text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {!!badgeCount && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-ink">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-hover text-xs font-semibold">
            {user.initials}
          </div>
          <span className="flex-1 truncate text-sm">{user.name}</span>
        </div>
        <Link
          href="/settings"
          className="mt-1 flex items-center gap-3 rounded-md px-2 py-2 text-sm text-sidebar-foreground-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
        >
          <Settings className="size-4" aria-hidden />
          Settings
        </Link>
      </div>
    </aside>
  );
}
