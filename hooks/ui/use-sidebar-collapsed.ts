"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tagr-sidebar-collapsed";

/**
 * Persists the Sidebar's collapsed state across reloads. Starts expanded on
 * both server and first client render (localStorage isn't available during
 * SSR), then syncs from storage in an effect — same pattern as
 * hooks/ui/use-device.ts. This means a collapsed sidebar briefly renders
 * expanded before that effect runs; accepted trade-off over a hydration
 * mismatch.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsedState(true);
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  return [collapsed, setCollapsed] as const;
}
