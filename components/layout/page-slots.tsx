"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/ui/use-device";
import { cn } from "@/lib/utils";

/** Places on a phone where a page's controls can be moved to: the app header, and the row next to the sub-navigation tabs. */
export type PageSlotName = "header" | "tabs";

interface PageSlotsContextValue {
  slots: Partial<Record<PageSlotName, HTMLElement>>;
  setSlot: (name: PageSlotName, element: HTMLElement | null) => void;
}

const PageSlotsContext = React.createContext<PageSlotsContextValue | null>(null);

/**
 * Sits in HubPage next to the header, so a view deep in `main` can hand controls to the header (a sibling it can't
 * reach through props) without owning its markup. The view stays the owner of the controls' state; only where they
 * are drawn changes.
 */
export function PageSlotsProvider({ children }: { children: React.ReactNode }) {
  const [slots, setSlots] = React.useState<PageSlotsContextValue["slots"]>({});

  const setSlot = React.useCallback((name: PageSlotName, element: HTMLElement | null) => {
    setSlots((current) => {
      if ((current[name] ?? null) === element) return current;
      const next = { ...current };
      if (element) next[name] = element;
      else delete next[name];
      return next;
    });
  }, []);

  const value = React.useMemo(() => ({ slots, setSlot }), [slots, setSlot]);
  return <PageSlotsContext.Provider value={value}>{children}</PageSlotsContext.Provider>;
}

/** The place controls are drawn into. Hidden while empty, so it takes no room (or gap) when a page sends nothing. */
export function PageSlot({ name, className }: { name: PageSlotName; className?: string }) {
  const setSlot = React.useContext(PageSlotsContext)?.setSlot;
  const ref = React.useCallback(
    (element: HTMLDivElement | null) => {
      setSlot?.(name, element);
    },
    [setSlot, name]
  );
  return <div ref={ref} className={cn("flex items-center gap-2 empty:hidden", className)} />;
}

/**
 * On a phone, draws `children` into the named slot instead of where this sits in the page; everywhere else (desktop,
 * or no slot on this page) it is just `children`, in place. React state and handlers stay with the component that
 * rendered this, so a Vault opened from the moved button still belongs to its view.
 */
export function PageSlotContent({ name, children }: { name: PageSlotName; children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const target = React.useContext(PageSlotsContext)?.slots[name];
  if (isMobile && target) return createPortal(children, target);
  return <>{children}</>;
}

/** Classes that turn a labelled toolbar `Button` into a square icon button on phones; pair with {@link MOBILE_LABEL} on its text. */
export const MOBILE_ICON_ONLY = "max-md:size-9 max-md:gap-0 max-md:px-0 text-primary";
/** Ghost look (no fill, accent-coloured text, muted hover) on phones only, for the add buttons beside the tabs; desktop keeps the normal filled button. */
export const MOBILE_GHOST = "max-md:bg-transparent max-md:text-primary max-md:hover:bg-muted";
export const MOBILE_LABEL = "max-md:sr-only";
