"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavItemActive } from "@/lib/navigation";

export interface SidebarUser {
  name: string;
  initials: string;
}

/** Exported so AppShell can compute its content offset without duplicating
 *  these numbers — see design.md's Sidebar section. */
export const SIDEBAR_WIDTH_EXPANDED = 216;
export const SIDEBAR_WIDTH_COLLAPSED = 72;
export const SIDEBAR_INSET = 16;
export const SIDEBAR_GAP = 16;

interface SidebarProps {
  user: SidebarUser;
  /** Overrides the pathname match — mainly for previews/tests. */
  activeHref?: string;
  badges?: Record<string, number>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /**
   * "responsive" (default): fixed to the viewport, hidden below md — the
   * real app behavior. "static": always visible, positioned absolute
   * within a `relative` ancestor — only for previews embedded in a
   * fixed-size frame, where the real viewport width can't be trusted.
   */
  variant?: "responsive" | "static";
  className?: string;
}

export function Sidebar({
  user,
  activeHref,
  badges,
  collapsed = false,
  onToggleCollapsed,
  variant = "responsive",
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const currentHref = activeHref ?? pathname;

  return (
    <aside
      className={cn(
        "top-4 bottom-4 left-4 z-30 flex flex-col overflow-hidden rounded-lg bg-sidebar text-sidebar-foreground shadow-md transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[216px]",
        variant === "responsive" ? "fixed hidden md:flex" : "absolute",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center py-6",
          collapsed ? "flex-col-reverse justify-center gap-2 px-0" : "justify-between gap-2 px-4"
        )}
      >
        <div className={cn("flex min-w-0 items-center gap-2", collapsed && "justify-center")}>
          <Image
            src="/brand/LogoBrand-Monocolor.png"
            alt=""
            width={100}
            height={100}
            className="h-6 w-auto shrink-0 object-contain"
          />
          {!collapsed && (
            <span className="truncate font-serif text-base font-semibold">
              TAGR <span className="text-accent">Holdings</span>
            </span>
          )}
        </div>

        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        )}
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
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md py-2.5 text-sm transition-colors",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                isActive
                  ? "text-accent font-medium"
                  : "text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
              )}
            >
              <span className="relative flex shrink-0 items-center justify-center">
                <Icon className="size-4" aria-hidden />
                {collapsed && !!badgeCount && (
                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-accent" />
                )}
              </span>
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && !!badgeCount && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-ink">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("mt-auto border-t border-sidebar-border py-4", collapsed ? "px-2" : "px-3")}>
        <div
          className={cn(
            "flex items-center rounded-md py-2",
            collapsed ? "justify-center px-0" : "gap-3 px-2"
          )}
          title={collapsed ? user.name : undefined}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-hover text-xs font-semibold">
            {user.initials}
          </div>
          {!collapsed && <span className="flex-1 truncate text-sm">{user.name}</span>}
        </div>
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "mt-1 flex items-center rounded-md py-2 text-sm text-sidebar-foreground-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
            collapsed ? "justify-center px-0" : "gap-3 px-2"
          )}
        >
          <Settings className="size-4 shrink-0" aria-hidden />
          {!collapsed && "Settings"}
        </Link>
      </div>
    </aside>
  );
}
