"use client";

import { useCallback, useEffect, useState } from "react";

/** The deployment this page was loaded from (inlined at build time — see next.config.ts). */
export const CURRENT_VERSION = process.env.NEXT_PUBLIC_BUILD_ID ?? "development";

const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Whether a newer deployment than the one this page loaded is live. An installed app can stay open for days
 * without reloading, so it asks /api/version on a timer and whenever it comes back to the foreground.
 * `applyUpdate` reloads onto the new version.
 */
export function useAppUpdate() {
  const [latest, setLatest] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/version", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { version?: string };
      setLatest(body.version ?? null);
      setFailed(false);
      setCheckedAt(new Date());
    } catch {
      // Offline or a hiccup: keep the last known answer, just say the check didn't go through.
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    // First check on the next tick — not inside the effect body, which would set state synchronously.
    const first = setTimeout(() => void check(), 0);
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const applyUpdate = useCallback(() => window.location.reload(), []);

  return { updateAvailable: latest !== null && latest !== CURRENT_VERSION, checking, checkedAt, failed, check, applyUpdate };
}
