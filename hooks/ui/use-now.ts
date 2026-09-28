"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

// Whole seconds: a primitive that stays equal between renders within the same second, as
// useSyncExternalStore requires (a raw Date.now() would change on every read).
const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000;

/** Current time in epoch ms, ticking every second. `null` during server render/hydration, so callers render a placeholder instead of mismatching. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
