"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, BOTTOM_NAV_MAX_PRIMARY, isNavItemActive } from "@/lib/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface BottomNavProps {
  /** Overrides the pathname match — mainly for previews/tests. */
  activeHref?: string;
  badges?: Record<string, number>;
  /**
   * "responsive" (default): fixed to the viewport, hidden at/above md — the
   * real app behavior. "static": always visible, positioned absolute
   * within a `relative` ancestor — only for previews embedded in a
   * fixed-size frame, where the real viewport width can't be trusted.
   */
  variant?: "responsive" | "static";
  className?: string;
}

/** Shared layoutId — framer-motion slides this pill between icons whenever
 *  the active tab changes, instead of it just popping into place. */
const ACTIVE_PILL_LAYOUT_ID = "bottom-nav-active-pill";

function NavIcon({
  isActive,
  badgeCount,
  children,
}: {
  isActive: boolean;
  badgeCount?: number;
  children: ReactNode;
}) {
  return (
    <span className="relative flex size-11 items-center justify-center">
      {isActive && (
        <motion.span
          layoutId={ACTIVE_PILL_LAYOUT_ID}
          className="absolute inset-1.5 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      )}
      <span
        className={cn(
          "relative transition-colors",
          isActive ? "text-ink" : "text-sidebar-foreground-muted"
        )}
      >
        {children}
      </span>
      {!!badgeCount && (
        <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-ink ring-2 ring-sidebar">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </span>
  );
}

export function BottomNav({ activeHref, badges, variant = "responsive", className }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentHref = activeHref ?? pathname;

  const primaryItems = NAV_ITEMS.slice(0, BOTTOM_NAV_MAX_PRIMARY);
  const overflowItems = NAV_ITEMS.slice(BOTTOM_NAV_MAX_PRIMARY);
  const isOverflowActive = overflowItems.some((item) => isNavItemActive(currentHref, item.href));

  return (
    <nav
      className={cn(
        "left-1/2 z-30 flex w-[87%] max-w-xs -translate-x-1/2 items-center justify-between gap-1 rounded-pill border border-sidebar-border bg-sidebar px-2 py-1.5 shadow-lg",
        variant === "responsive" ? "fixed md:hidden" : "absolute bottom-4",
        className
      )}
      style={
        variant === "responsive"
          ? { bottom: "calc(1rem + env(safe-area-inset-bottom))" }
          : undefined
      }
    >
      {primaryItems.map((item) => {
        const isActive = isNavItemActive(currentHref, item.href);
        const badgeCount = item.badgeKey ? badges?.[item.badgeKey] : undefined;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            className="flex flex-1 items-center justify-center"
          >
            <NavIcon isActive={isActive} badgeCount={badgeCount}>
              <Icon className="size-5" aria-hidden />
            </NavIcon>
          </Link>
        );
      })}

      {overflowItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More"
              className="flex flex-1 items-center justify-center"
            >
              <NavIcon isActive={isOverflowActive}>
                <MoreHorizontal className="size-5" aria-hidden />
              </NavIcon>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>More</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {overflowItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem
                  key={item.href}
                  onSelect={() => router.push(item.href)}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}
