"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { NavSectionId } from "@/lib/navigation";

const STORAGE_KEY = "tagr-sidebar-closed-sections";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** A string, not an array: useSyncExternalStore compares snapshots with Object.is. */
function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Which collapsible Sidebar sections (Traction, EOS) the person folded away, kept across reloads — same
 * localStorage + useSyncExternalStore approach as useSidebarCollapsed (server snapshot: everything open).
 */
export function useClosedNavSections() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const closed = new Set(raw.split(",").filter(Boolean) as NavSectionId[]);

  const toggle = useCallback((id: NavSectionId) => {
    const next = new Set(getSnapshot().split(",").filter(Boolean));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, [...next].join(","));
    } catch {
      // Storage blocked (private mode) — the change just won't persist.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [closed, toggle] as const;
}
