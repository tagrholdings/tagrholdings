"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HeaderSearchConfig {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

/** `enabled: false` keeps the icon out of the header — e.g. while the page shows an empty state with nothing to filter. */
type UseHeaderSearchConfig = HeaderSearchConfig & { enabled?: boolean };

interface HeaderSearchContextValue {
  config: HeaderSearchConfig | null;
  register: (config: HeaderSearchConfig | null) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const HeaderSearchContext = React.createContext<HeaderSearchContextValue | null>(null);

/**
 * Lets a page's view hand its text filter to the mobile header (see
 * `useHeaderSearch`). Provider sits in HubPage so it wraps both the header
 * and `main` — the two are siblings, so there's no other way for the view's
 * state to reach the header. Per-route by construction: navigating remounts
 * HubPage, which resets both the registration and the open/closed state.
 */
export function HeaderSearchProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<HeaderSearchConfig | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  // Derived, not stored: a view that unregisters (or a tab that swaps its
  // filter out) must not leave the header stuck on an expanded input with
  // nothing behind it.
  const open = expanded && config !== null;

  const value = React.useMemo<HeaderSearchContextValue>(
    () => ({ config, register: setConfig, open, setOpen: setExpanded }),
    [config, open]
  );

  return <HeaderSearchContext.Provider value={value}>{children}</HeaderSearchContext.Provider>;
}

/**
 * Publishes a view's text filter to the mobile header, which renders it as
 * an icon that expands over the header on tap. The view keeps owning the
 * state — this only mirrors it — so the desktop input stays exactly as it
 * was; hide that one below `md` (`hidden md:block`) since the header takes
 * over there. Safe to call outside a provider (previews): it no-ops.
 */
export function useHeaderSearch({ placeholder, value, onChange, enabled = true }: UseHeaderSearchConfig) {
  const ctx = React.useContext(HeaderSearchContext);
  const register = ctx?.register;

  // onChange is a fresh closure on every render; keeping it in a ref is what
  // stops the effect below from re-registering on unrelated re-renders. This
  // effect is declared first so the ref is current before that one reads it.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  React.useEffect(() => {
    if (!register || !enabled) return;
    register({ placeholder, value, onChange: (next) => onChangeRef.current(next) });
    return () => register(null);
  }, [register, placeholder, value, enabled]);
}

/** The collapsed state: one icon button in the header. Renders nothing when the page has no search. */
export function HeaderSearchButton({ className }: { className?: string }) {
  const ctx = React.useContext(HeaderSearchContext);
  if (!ctx?.config) return null;

  return (
    <button
      type="button"
      aria-label="Search"
      aria-expanded={ctx.open}
      onClick={() => ctx.setOpen(true)}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted",
        className
      )}
    >
      <Search className="size-4" />
    </button>
  );
}

/**
 * The expanded state: covers the header bar with the input + a close button.
 * Absolutely positioned over the header (which is `relative`) so the title
 * row underneath keeps its layout and simply fades out.
 */
export function HeaderSearchBar() {
  const ctx = React.useContext(HeaderSearchContext);
  const config = ctx?.config ?? null;
  const open = Boolean(ctx?.open && config);

  const close = React.useCallback(() => {
    // Closing clears the filter: once collapsed there's nothing on screen to
    // show a filter is still applied, and a silently filtered list reads as
    // missing data.
    config?.onChange("");
    ctx?.setOpen(false);
  }, [config, ctx]);

  return (
    <AnimatePresence>
      {open && config && (
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute inset-0 z-10 flex items-center gap-2 bg-background px-4"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              autoFocus
              placeholder={config.placeholder}
              value={config.value}
              onChange={(e) => config.onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
              className="h-9 pl-9"
            />
          </div>
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
