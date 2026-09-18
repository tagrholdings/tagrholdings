"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tagr-theme";
export type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Persists an explicit theme choice, falling back to the OS preference when
 * the user hasn't picked one. `data-theme` on <html> is the source of truth
 * for CSS (see globals.css); this hook only keeps React state in sync with
 * it and with localStorage. The inline script in app/layout.tsx sets
 * `data-theme` before hydration so there's no flash — this hook just reads
 * that same resolved value back on mount instead of guessing "light" first.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    setThemeState(stored ?? systemTheme());
  }, []);

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    document.documentElement.setAttribute("data-theme", value);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
