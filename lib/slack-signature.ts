import { createHmac, timingSafeEqual } from "node:crypto";

/** Slack signs `v0:<timestamp>:<raw body>` with the app's signing secret; a request older than this is a replay. */
const MAX_AGE_SECONDS = 5 * 60;

/**
 * True when `signature` (the `X-Slack-Signature` header) matches the raw body signed with `secret` and `timestamp` (the
 * `X-Slack-Request-Timestamp` header) is recent. Always verify against the RAW body — re-serialised JSON won't match.
 */
export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null, secret: string, now: Date = new Date()): boolean {
  if (!timestamp || !signature) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now.getTime() / 1000 - sentAt) > MAX_AGE_SECONDS) return false;

  const expected = Buffer.from(`v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`);
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
