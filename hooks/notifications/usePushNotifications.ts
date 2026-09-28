"use client";

import { useCallback, useEffect, useState } from "react";
import { notify } from "@/components/ui/toaster";
import { subscribePushAction, unsubscribePushAction } from "@/modules/notifications/notifications.actions";
import { urlBase64ToUint8Array } from "@/utils/push";

/**
 * loading      checking this browser
 * unsupported  no service worker / Push API (or the server has no VAPID key)
 * needs-install iOS Safari only delivers push to an app added to the Home Screen
 * denied       the person blocked notifications in the browser — only browser settings can undo that
 * off          supported, not subscribed on this device
 * on           subscribed on this device
 */
export type PushStatus = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function isIosBrowserTab() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(() => navigator.serviceWorker.ready);
}

/** This device's notification switch: registers the service worker, asks permission, and stores/removes the subscription on the server. */
export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: PushStatus;
      if (isIosBrowserTab()) next = "needs-install";
      else if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const existing = await (await registration()).pushManager.getSubscription();
        next = existing && Notification.permission === "granted" ? "on" : "off";
      }
      if (!cancelled) setStatus(next);
    })().catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        notify.error("Notifications were not allowed. You can allow them in your browser's site settings.");
        return;
      }
      const reg = await registration();
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) }));

      const json = subscription.toJSON();
      const result = await subscribePushAction({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        userAgent: navigator.userAgent.slice(0, 500),
      });
      if (!result?.data) {
        await subscription.unsubscribe().catch(() => undefined);
        notify.error(result?.serverError ?? "Couldn't turn notifications on. Please try again.");
        return;
      }
      setStatus("on");
      notify.success("Notifications are on for this device.");
    } catch {
      notify.error("Couldn't turn notifications on. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const subscription = await (await registration()).pushManager.getSubscription();
      if (subscription) {
        const result = await unsubscribePushAction({ endpoint: subscription.endpoint });
        if (!result?.data) {
          notify.error(result?.serverError ?? "Couldn't turn notifications off. Please try again.");
          return;
        }
        await subscription.unsubscribe();
      }
      setStatus("off");
      notify.success("Notifications are off for this device.");
    } catch {
      notify.error("Couldn't turn notifications off. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable, disable };
}
