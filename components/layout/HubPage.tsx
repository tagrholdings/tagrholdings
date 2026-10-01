import { cn } from "@/lib/utils";
import { AppHeader, type AppHeaderAction, type AppHeaderUser } from "./AppHeader";
import { HeaderSearchProvider } from "./header-search";

interface HubPageProps {
  user: AppHeaderUser;
  kicker?: string;
  title: string;
  backHref?: string;
  showSearch?: boolean;
  primaryAction?: AppHeaderAction;
  onSignOut?: () => void;
  /**
   * From `md` up, make the page exactly one screen tall so the page itself never scrolls: `main` takes the
   * height left under the header and clips, and the page's content is expected to fill it (`flex-1 min-h-0`)
   * and page its lists to fit — see hooks/ui/use-fit-page-size.ts. On a phone the page scrolls as usual.
   */
  fitViewport?: boolean;
  children: React.ReactNode;
}

/**
 * Per-route content: `AppHeader` (title/kicker vary per page, so this can't
 * live in `app/(hub)/layout.tsx` — see HubChrome.tsx's comment) + `main`.
 * Sidebar/BottomNav come from the layout wrapping this, not from here —
 * don't reintroduce them; that's what made the old `AppShell` remount the
 * whole chrome on every navigation.
 */
export function HubPage({ user, kicker, title, backHref, showSearch, primaryAction, onSignOut, fitViewport, children }: HubPageProps) {
  return (
    <HeaderSearchProvider>
      <AppHeader
        kicker={kicker}
        title={title}
        backHref={backHref}
        showSearch={showSearch}
        primaryAction={primaryAction}
        user={user}
        onSignOut={onSignOut}
      />
      <main
        className={cn(
          "flex flex-1 flex-col gap-6 px-4 py-2 pb-24 md:px-6 md:pt-0 md:pb-8",
          // Column = header (5rem) + gap (1rem) + main, so main takes the rest of the viewport.
          fitViewport && "md:h-[calc(100dvh-6rem)] md:min-h-0 md:flex-none md:gap-4 md:overflow-hidden md:pb-6"
        )}
      >
        {children}
      </main>
    </HeaderSearchProvider>
  );
}
