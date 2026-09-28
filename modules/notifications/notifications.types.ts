import { z } from "zod";

/**
 * Hosts a browser's Web Push endpoint can legitimately be on (FCM for Chrome/Edge/Opera/Samsung, Mozilla autopush,
 * Apple, Windows). The server POSTs to whatever endpoint it's given, so an arbitrary URL would let a signed-in user
 * make the server call any address it can reach — only these push services are accepted.
 */
const PUSH_SERVICE_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_SERVICE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export const subscribePushSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
  userAgent: z.string().max(500).optional(),
});
export type SubscribePushInput = z.infer<typeof subscribePushSchema>;

export const unsubscribePushSchema = z.object({ endpoint: z.url().max(2048) });

/** What the service worker receives (public/sw.js) — keep the two in step. */
export interface PushPayload {
  title: string;
  body: string;
  /** In-app path opened when the notification is tapped. */
  url: string;
  /** Same tag replaces an earlier notification instead of stacking (one per activity). */
  tag?: string;
}
