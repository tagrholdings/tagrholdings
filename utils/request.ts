/**
 * The client's IP as reported by the platform. On Vercel, `x-forwarded-for`
 * is set by the edge and can't be spoofed by the client — behind any other
 * proxy that doesn't overwrite it, the first entry is attacker-controlled.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}
