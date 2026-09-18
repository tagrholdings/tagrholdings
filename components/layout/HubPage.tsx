import { AppHeader, type AppHeaderAction, type AppHeaderUser } from "./AppHeader";

interface HubPageProps {
  user: AppHeaderUser;
  kicker?: string;
  title: string;
  backHref?: string;
  showSearch?: boolean;
  primaryAction?: AppHeaderAction;
  onSignOut?: () => void;
  children: React.ReactNode;
}

/**
 * Per-route content: `AppHeader` (title/kicker vary per page, so this can't
 * live in `app/(hub)/layout.tsx` — see HubChrome.tsx's comment) + `main`.
 * Sidebar/BottomNav come from the layout wrapping this, not from here —
 * don't reintroduce them; that's what made the old `AppShell` remount the
 * whole chrome on every navigation.
 */
export function HubPage({ user, kicker, title, backHref, showSearch, primaryAction, onSignOut, children }: HubPageProps) {
  return (
    <>
      <AppHeader
        kicker={kicker}
        title={title}
        backHref={backHref}
        showSearch={showSearch}
        primaryAction={primaryAction}
        user={user}
        onSignOut={onSignOut}
      />
      <main className="flex flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:pt-0 md:pb-8">{children}</main>
    </>
  );
}
