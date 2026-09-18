"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "tagr-sidebar-collapsed";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Persists the Sidebar's collapsed state across reloads, read through
 * `useSyncExternalStore` — the server snapshot is always "expanded"
 * (localStorage isn't available during SSR), and React swaps in the stored
 * value right after hydration without a mismatch. A collapsed sidebar still
 * briefly renders expanded on first paint; accepted trade-off.
 */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const setCollapsed = useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Storage blocked (private mode) — the change just won't persist.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [collapsed, setCollapsed] as const;
}
