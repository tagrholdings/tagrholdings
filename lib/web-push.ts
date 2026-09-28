import "server-only";
import webpush from "web-push";

/**
 * Web Push sender (VAPID). Kept out of the service so the service stays testable without the network.
 *
 * Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY (also read by the browser to subscribe), VAPID_PRIVATE_KEY, and
 * VAPID_SUBJECT (a `mailto:` or https URL push services can contact; defaults to the notification inbox).
 */

export type PushResult = "sent" | "gone" | "failed" | "not_configured";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  const subject = process.env.VAPID_SUBJECT?.trim() || `mailto:${process.env.TANNER_NOTIFICATION_EMAIL?.trim() || "admin@tagrholdings.com"}`;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return configure();
}

/** "gone" = the push service says this subscription no longer exists (404/410) — the caller should delete it. */
export async function sendPush(target: PushTarget, payload: unknown): Promise<PushResult> {
  if (!configure()) return "not_configured";
  try {
    await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payload), {
      TTL: 60 * 60,
      urgency: "high",
    });
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("Web push failed:", status ?? "", error instanceof Error ? error.message : error);
    return "failed";
  }
}
