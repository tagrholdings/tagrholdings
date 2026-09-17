"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/components/ui/toaster";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

/**
 * `onSignOut` can't be passed down from page.tsx (a Server Component) — a
 * closure over `authClient` isn't a serializable prop across that boundary.
 * So sign-out is handled here by default; `onSignOut` stays as an optional
 * override for previews/tests that render AppHeader from a client tree.
 */
function useDefaultSignOut() {
  const router = useRouter();
  return async () => {
    // See the matching comment in SignInForm.tsx — authClient methods can
    // reject instead of resolving { error }.
    let error: { message?: string } | null = null;
    try {
      ({ error } = await authClient.signOut());
    } catch (caught) {
      error = { message: caught instanceof Error ? caught.message : undefined };
    }

    if (error) {
      notify.error(error.message ?? "Couldn't sign out. Please try again.");
      return;
    }
    router.push("/auth/sign-in");
    router.refresh();
  };
}

function MobileHeader({
  title,
  backHref,
  primaryAction,
  user,
  onSignOut,
  className,
}: AppHeaderProps & { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-divider bg-background px-4",
        className
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
      ) : (
        <div className="size-1" />
      )}
      <h1 className="flex-1 truncate font-serif text-base font-semibold text-ink">
        {title}
      </h1>
      {primaryAction && (
        <Button size="sm" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-ink"
          >
            {user.initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
}: AppHeaderProps & { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-4 z-20 h-16 shrink-0 items-center gap-4 rounded-lg px-6",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {kicker && <p className="label-kicker">{kicker}</p>}
        <h1 className="truncate font-serif text-xl font-semibold text-ink">{title}</h1>
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-ink transition-colors hover:bg-surface-alt"
          >
            {user.initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
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
