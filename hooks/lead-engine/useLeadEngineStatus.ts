"use client";

import { useCallback, useRef } from "react";
import useSWR from "swr";
import { isRunActive, type LiveRunsResponse } from "@/modules/lead-engine/live-runs";

const ENDPOINT = "/api/lead-engine/status";
/** While a run is going (or was just started), ask GitHub this often. */
const ACTIVE_POLL_MS = 8_000;
/** Otherwise just glance now and then, so a scheduled run that starts while the page is open shows up. */
const IDLE_POLL_MS = 60_000;
/** After "Run now", poll fast for this long even before GitHub lists the run (it takes a moment to appear). */
const BOOST_MS = 2 * 60_000;

const fetcher = async (url: string): Promise<LiveRunsResponse> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
};

/**
 * Live view of the lead engine's GitHub Actions runs. Polls fast while a run is active or was just started,
 * slowly otherwise; nothing polls while the tab is hidden (SWR's default). `startWatching()` is for right after
 * "Run now": it polls once soon and then keeps a fast pace for a couple of minutes.
 */
export function useLeadEngineStatus() {
  const boostUntil = useRef(0);
  const { data, mutate } = useSWR<LiveRunsResponse>(ENDPOINT, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 3_000,
    // Re-evaluated after every answer: fast while anything is running or a fast window is open.
    refreshInterval: (latest) => (latest?.runs.some(isRunActive) || Date.now() < boostUntil.current ? ACTIVE_POLL_MS : IDLE_POLL_MS),
  });

  const startWatching = useCallback(() => {
    boostUntil.current = Date.now() + BOOST_MS;
    // The run isn't listed the instant it's dispatched: look right away, then again shortly.
    void mutate();
    setTimeout(() => void mutate(), 2_500);
  }, [mutate]);

  return { status: data, startWatching };
}
