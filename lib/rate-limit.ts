const hits = new Map<string, number[]>();

/**
 * In-memory sliding-window rate limiter. Per-process only — under multiple
 * serverless instances each instance tracks its own counters, so this limits
 * abuse from a single instance/IP rather than guaranteeing a global cap.
 */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) || []).filter(
    (t) => now - t < windowMs
  );

  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}
