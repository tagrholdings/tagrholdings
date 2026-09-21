/**
 * The client's IP as reported by the platform. On Vercel, `x-forwarded-for`
 * is set by the edge and can't be spoofed by the client — behind any other
 * proxy that doesn't overwrite it, the first entry is attacker-controlled.
 *
 * Takes a `Headers` object rather than a `Request` so it works both in
 * Route Handlers (`request.headers`) and in Server Actions, which only
 * expose the incoming request via `await headers()` from `next/headers`.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return headers.get("x-real-ip") || "unknown";
}
