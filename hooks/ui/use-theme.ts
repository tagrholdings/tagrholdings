"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "tagr-theme";
export type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * `data-theme` on <html> is the source of truth — the inline script in
 * app/layout.tsx sets it (stored choice, else OS preference) before
 * hydration, so this just reads that resolved value back.
 */
function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Persists an explicit theme choice, falling back to the OS preference when
 * the user hasn't picked one. See globals.css for how `data-theme` drives
 * the tokens. Server snapshot is "light"; React re-reads the real value
 * right after hydration (useSyncExternalStore), no effect needed.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, (): Theme => "light");

  const setTheme = useCallback((value: Theme) => {
    document.documentElement.setAttribute("data-theme", value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage blocked (private mode) — the choice just won't persist.
    }
    listeners.forEach((listener) => listener());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
