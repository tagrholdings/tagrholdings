"use client";

import { useEffect } from "react";
import { playNotificationChime } from "@/utils/notification-sound";

/**
 * Plays the chime when the service worker reports a push arrived while this tab is open and in view
 * (public/sw.js posts `push-received` to every window). In the background the OS makes the sound, so a hidden
 * tab stays quiet here. Renders nothing; mounted once in the hub shell.
 */
export function PushSoundListener() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "push-received" && document.visibilityState === "visible") playNotificationChime();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
