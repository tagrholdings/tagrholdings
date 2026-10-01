"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Check, Loader2, LogOut, Settings, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { switchWorkspacePath, workspacePath } from "@/lib/workspace-path";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "./workspace-context";

export interface AccountUser {
  name: string;
  initials: string;
}

/**
 * `onSignOut` can't be passed down from page.tsx (a Server Component) — a
 * closure over `authClient` isn't a serializable prop across that boundary.
 * So sign-out is handled here by default.
 */
export function useDefaultSignOut() {
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

/** A workspace's initial in a small tile — the current one in the accent colour. */
function WorkspaceTile({ name, current }: { name: string; current: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold uppercase",
        current ? "bg-accent text-ink" : "bg-surface-alt text-foreground"
      )}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

/** Section heading, left-aligned in both the desktop dropdown and the mobile sheet. */
function MenuHeading({ children }: { children: React.ReactNode }) {
  return <DropdownMenuLabel className="label-kicker px-3 pt-2 pb-1 text-left font-normal text-muted-foreground">{children}</DropdownMenuLabel>;
}

/**
 * The workspaces the person can switch to, with the current one ticked. Picking one navigates to the SAME page in that
 * workspace (`/w/a/contacts` → `/w/b/contacts`) inside a transition: the menu stays open with a spinner on the target
 * and the current screen stays untouched until the new workspace is ready, so nothing from the old workspace is ever
 * shown under the new one's name. Items aren't prefetched — that would load other workspaces' data ahead of time.
 */
function WorkspaceSwitcherItems() {
  const router = useRouter();
  const pathname = usePathname();
  const workspace = useWorkspace();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);

  // One workspace and no super-admin powers: nothing to switch, so no list — the header already names it.
  if (workspace.workspaces.length <= 1 && !workspace.isSuperAdmin) return null;

  return (
    <>
      <MenuHeading>Workspaces</MenuHeading>
      {workspace.workspaces.map((w) => {
        const isCurrent = w.slug === workspace.slug;
        return (
          <DropdownMenuItem
            key={w.slug}
            className="gap-3 text-left md:py-2"
            onSelect={(event) => {
              event.preventDefault();
              if (isCurrent || pending) return;
              setTarget(w.slug);
              startTransition(() => router.push(switchWorkspacePath(pathname, w.slug)));
            }}
          >
            <WorkspaceTile name={w.name} current={isCurrent} />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm", isCurrent && "font-semibold text-foreground")}>{w.name}</span>
              <span className="block text-xs font-normal text-muted-foreground capitalize">{w.role}</span>
            </span>
            {pending && target === w.slug ? <Loader2 className="animate-spin" aria-hidden /> : isCurrent ? <Check className="text-accent-text" aria-hidden /> : null}
          </DropdownMenuItem>
        );
      })}
      {workspace.isSuperAdmin && (
        <DropdownMenuItem className="gap-3 text-left md:py-2" onSelect={() => router.push("/admin")}>
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-divider">
            <ShieldCheck className="size-4" />
          </span>
          Manage workspaces
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
    </>
  );
}

/** The avatar dropdown's body — shared by the header (mobile sheet + desktop dropdown) and the sidebar so they can't drift apart. */
export function AccountMenuContent({
  user,
  onSignOut,
  side,
  align = "end",
}: {
  user: AccountUser;
  onSignOut?: () => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const router = useRouter();
  const workspace = useWorkspace();
  const defaultSignOut = useDefaultSignOut();

  return (
    <DropdownMenuContent align={align} side={side} className="sm:min-w-[90vw] md:min-w-64 min-w-[90vw]">
      {/* Who's signed in and where: same avatar as the trigger, then name and "Workspace · role". */}
      <DropdownMenuLabel className="flex items-center gap-3 px-3 py-3 text-left text-foreground">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-ink">{user.initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold md:text-sm">{user.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {workspace.name} · <span className="capitalize">{workspace.role}</span>
          </span>
        </span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <WorkspaceSwitcherItems />
      {/* Every row: icon + label, same left edge. */}
      <DropdownMenuItem className="gap-3 text-left" onSelect={() => router.push(workspacePath(workspace.slug, "/settings"))}>
        <Settings aria-hidden />
        Settings
      </DropdownMenuItem>
      <DropdownMenuItem className="gap-3 text-left" onSelect={() => router.push(workspacePath(workspace.slug, "/docs"))}>
        <BookOpen aria-hidden />
        Documentation
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" className="gap-3 text-left" onSelect={onSignOut ?? defaultSignOut}>
        <LogOut aria-hidden />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
