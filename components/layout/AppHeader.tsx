"use client";

import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/ui/use-scrolled";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PageHelp } from "./PageHelp";
import { HeaderSearchBar, HeaderSearchButton } from "./header-search";
import { PageSlot } from "./page-slots";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AccountMenuContent, useDefaultSignOut } from "./AccountMenu";
import { useWorkspace } from "./workspace-context";

export interface AppHeaderUser {
  name: string;
  initials: string;
}

export interface AppHeaderAction {
  label: string;
  onClick?: () => void;
}

interface AppHeaderProps {
  /** Section eyebrow shown above the title on desktop, e.g. "DEAL FLOW". */
  kicker?: string;
  title: string;
  /** Shows a back button on mobile (drilled-into views, e.g. a pipeline item). */
  backHref?: string;
  showSearch?: boolean;
  primaryAction?: AppHeaderAction;
  user: AppHeaderUser;
  onSignOut?: () => void;
  /**
   * Forces a single rendering regardless of viewport — only meant for
   * previews/demos embedded in a fixed-size frame. Leave unset in real
   * pages so both variants ship and Tailwind's `md:` breakpoint decides.
   */
  forceMode?: "desktop" | "mobile";
  className?: string;
}

function MobileHeader({
  title,
  backHref,
  primaryAction,
  className,
}: AppHeaderProps & { className?: string }) {
  const { inboundAddress } = useWorkspace();
  return (
    <header
      className={cn(
        // `sticky` already positions this row, so the expanded search bar can
        // cover it with `absolute inset-0` without an extra `relative`.
        "sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-divider bg-background px-4",
        className
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate font-serif text-base font-semibold text-foreground">
        {title}
      </h1>
      {primaryAction && (
        <Button size="sm" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </Button>
      )}
      <PageHelp inboxAddress={inboundAddress} />
      {/* Controls a page moves up here on a phone (view toggle, "New …") — see page-slots.tsx. */}
      <PageSlot name="header" className="shrink-0 gap-1" />
      <HeaderSearchButton />

      {/* Collapsed, the page's filter is just the icon above; tapping it
          expands the input over this whole row so a phone spends no vertical
          space on a search box. */}
      <HeaderSearchBar />
    </header>
  );
}

function DesktopHeader({
  kicker,
  title,
  showSearch,
  primaryAction,
  user,
  onSignOut,
  className,
  backHref
}: AppHeaderProps & { className?: string }) {
  const { inboundAddress } = useWorkspace();
  // Transparent at the top of the page; once content scrolls under it, it takes a frosted background so the
  // page doesn't show through the title. `top-0` + `pt-4` (not `top-4`): the 16px above the bar must be covered
  // too, or content slides past in that gap.
  const scrolled = useScrolled();
  return (
    <header
      className={cn(
        "sticky top-0 z-20 h-20 shrink-0 items-center gap-4 border-b border-transparent px-6 pt-4 transition-[background-color,border-color] duration-200",
        scrolled && "rounded-b-lg border-divider bg-background/80 backdrop-blur-md",
        className
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
      ) : (
        <div className="hidden" />
      )}
      <div className="min-w-0 flex-1">
        {kicker && <p className="label-kicker text-muted-foreground">{kicker}</p>}
        <h1 className="truncate font-serif text-xl font-semibold text-foreground">{title}</h1>
      </div>

      {showSearch && (
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9" />
        </div>
      )}

      {primaryAction && (
        <Button size="sm" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </Button>
      )}

      <PageHelp inboxAddress={inboundAddress} />
      <ThemeToggle className="hover:bg-muted" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-surface-alt"
          >
            {user.initials}
          </button>
        </DropdownMenuTrigger>
        <AccountMenuContent user={user} onSignOut={onSignOut} />
      </DropdownMenu>
    </header>
  );
}

/**
 * One adaptive header for both layouts (design.md — "Global adaptive
 * header"). Both variants render so Tailwind's `md:` breakpoint can switch
 * between them with zero JS/hydration flicker — unless `forceMode` pins one
 * down for a preview embedded in a fixed-size frame.
 */
export function AppHeader(props: AppHeaderProps) {
  const { forceMode, className, onSignOut } = props;
  const defaultSignOut = useDefaultSignOut();
  const resolvedProps = { ...props, onSignOut: onSignOut ?? defaultSignOut };

  if (forceMode === "mobile") {
    return <MobileHeader {...resolvedProps} className={cn("flex", className)} />;
  }
  if (forceMode === "desktop") {
    return <DesktopHeader {...resolvedProps} className={cn("flex", className)} />;
  }

  return (
    <>
      <MobileHeader {...resolvedProps} className={cn("flex md:hidden", className)} />
      <DesktopHeader {...resolvedProps} className={cn("hidden md:flex", className)} />
    </>
  );
}
