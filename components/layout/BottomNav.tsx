"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, BOTTOM_NAV_MAX_PRIMARY, isNavItemActive, sectionForPath, type NavSectionId } from "@/lib/navigation";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AccountMenuContent, type AccountUser } from "./AccountMenu";

interface BottomNavProps {
  /** Overrides the pathname match — mainly for previews/tests. */
  activeHref?: string;
  badges?: Record<string, number>;
  /** Shows the account menu (avatar) as the last tab, at the right end. Left out of previews. */
  user?: AccountUser;
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

/** How far (px) — or how fast (px/s) — the bar has to be pulled down to switch section. */
const SWITCH_DISTANCE = 28;
const SWITCH_VELOCITY = 400;

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
    <span
      className={cn(
        "relative flex h-11 items-center justify-center transition-all duration-300",
        isActive ? "px-4" : "w-11"
      )}
    >
      {isActive && (
        <motion.span
          layoutId={ACTIVE_PILL_LAYOUT_ID}
          className="absolute inset-1 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      )}
      <span
        className={cn(
          "relative z-10 flex items-center gap-2 transition-colors",
          isActive ? "text-ink" : "text-sidebar-foreground-muted"
        )}
      >
        {children}
      </span>
      {!!badgeCount && (
        <span className="absolute right-0 top-0 z-20 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-ink ring-2 ring-sidebar">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </span>
  );
}

/**
 * The phone's floating pill nav. It shows ONE section at a time (CRM or Traction — lib/navigation.ts): pull the bar
 * down to switch to the other one (explained in the page tours). Landing on a page shows that page's section;
 * switching only swaps the tabs, it doesn't navigate.
 */
export function BottomNav({ activeHref, badges, user, variant = "responsive", className }: BottomNavProps) {
  const pathname = usePathname();
  const path = useWorkspacePath();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const currentHref = activeHref ?? pathname;

  // A manual switch holds only for the page it was made on; navigating anywhere shows that page's own section again.
  const [manual, setManual] = useState<{ section: NavSectionId; href: string | null } | null>(null);
  const sectionId = manual && manual.href === currentHref ? manual.section : sectionForPath(currentHref);
  const sectionIndex = NAV_SECTIONS.findIndex((s) => s.id === sectionId);
  const section = NAV_SECTIONS[sectionIndex];
  const nextSection = NAV_SECTIONS[(sectionIndex + 1) % NAV_SECTIONS.length];

  // A drag ends with a pointerup over whichever tab it started on; that click must not navigate.
  const dragged = useRef(false);

  function switchSection() {
    setManual({ section: nextSection.id, href: currentHref });
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > SWITCH_DISTANCE || info.velocity.y > SWITCH_VELOCITY) switchSection();
  }

  const primaryItems = section.items.slice(0, BOTTOM_NAV_MAX_PRIMARY);
  const overflowItems = section.items.slice(BOTTOM_NAV_MAX_PRIMARY);
  const isOverflowActive = overflowItems.some((item) => isNavItemActive(currentHref, item.href, item.exact));

  return (
    <div
      className={cn(
        "pointer-events-none inset-x-0 z-30 flex flex-col items-center gap-1.5",
        variant === "responsive" ? "fixed md:hidden" : "absolute bottom-4",
        className
      )}
      style={variant === "responsive" ? { bottom: "calc(1rem + env(safe-area-inset-bottom))" } : undefined}
    >
      {/* The gesture is the way to switch; this is the same switch for keyboards and screen readers — invisible until focused. */}
      <button
        type="button"
        onClick={switchSection}
        className="pointer-events-auto sr-only rounded-pill bg-sidebar px-3 py-1 text-xs text-sidebar-foreground focus:not-sr-only"
      >
        Switch to {nextSection.label}
      </button>

      <motion.nav
        data-tour="nav-bottom"
        aria-label={`${section.label} navigation`}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.6 }}
        dragSnapToOrigin
        onDragStart={() => (dragged.current = true)}
        onDragEnd={handleDragEnd}
        onClickCapture={(e) => {
          if (!dragged.current) return;
          dragged.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={() => (dragged.current = false)}
        className="pointer-events-auto flex w-max touch-none items-center justify-between gap-1 overflow-hidden rounded-pill border border-sidebar-border bg-sidebar px-2 py-1.5"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={section.id}
            className="flex items-center gap-1"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {primaryItems.map((item) => {
              const isActive = isNavItemActive(currentHref, item.href, item.exact);
              const badgeCount = item.badgeKey ? badges?.[item.badgeKey] : undefined;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={path(item.href)}
                  draggable={false}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  className={cn(
                    "flex flex-row items-center justify-center transition-all",
                    isActive ? "flex-[2]" : "flex-1"
                  )}
                >
                  <NavIcon isActive={isActive} badgeCount={badgeCount}>
                    <Icon className="size-5 shrink-0" aria-hidden />
                    {isActive && (
                      <span className="text-sm font-medium whitespace-nowrap">
                        {item.label}
                      </span>
                    )}
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
                    className={cn(
                      "flex items-center justify-center transition-all",
                      isOverflowActive ? "flex-[2]" : "flex-1"
                    )}
                  >
                    <NavIcon isActive={isOverflowActive}>
                      <MoreHorizontal className="size-5 shrink-0" aria-hidden />
                      {isOverflowActive && (
                        <span className="text-sm font-medium whitespace-nowrap">
                          More
                        </span>
                      )}
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
                        onSelect={() => router.push(path(item.href))}
                      >
                        <Icon className="size-4" aria-hidden />
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </motion.div>
        </AnimatePresence>

        {/* The account menu (settings, workspaces, theme, sign out) lives here on a phone, not in the header. */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Account menu" className="flex flex-1 items-center justify-center transition-all">
                <span className="flex h-11 w-11 items-center justify-center">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-sidebar-foreground">
                    {user.initials}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <AccountMenuContent user={user} side="top" align="end" />
          </DropdownMenu>
        )}
      </motion.nav>
    </div>
  );
}
