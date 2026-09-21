import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CRM_HOST = "crm.tagrholdings.com";
const MARKETING_HOSTS = new Set(["www.tagrholdings.com", "tagrholdings.com"]);

// The stable, small list of paths that belong to the marketing site — not
// the CRM hub. Everything else defaults to "hub route" on the CRM host and
// gets redirected there from a known marketing host. Keeping this list
// small (instead of enumerating every hub path) is what makes this scale as
// the hub grows — see .agents/docs/DOMAINS.md for why.
const MARKETING_PATHS = ["/", "/portal", "/portal/tools"];
const MARKETING_API_PREFIXES = ["/api/contact"];

function isMarketingPath(pathname: string) {
  return (
    MARKETING_PATHS.includes(pathname) ||
    MARKETING_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isCrmHost(host: string) {
  return host === CRM_HOST || host.startsWith("crm.localhost");
}

export default function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname, search } = request.nextUrl;

  // Shared by both hosts — sign-in only ever happens on the CRM subdomain,
  // but the route itself doesn't need to be redirected either way.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (isCrmHost(host)) {
    if (pathname === "/") {
      // The hub's home has no route of its own at "/" — app/page.tsx there
      // is already the marketing landing page — so rewrite silently to the
      // real page. The URL bar keeps showing crm.tagrholdings.com/.
      return NextResponse.rewrite(new URL(`/activities${search}`, request.url));
    }
    if (isMarketingPath(pathname)) {
      // A marketing-only path has nothing to serve on the CRM host.
      return NextResponse.redirect(
        new URL(`https://www.tagrholdings.com${pathname}${search}`, request.url)
      );
    }
    return NextResponse.next();
  }

  if (MARKETING_HOSTS.has(host)) {
    // Known marketing host: hub routes only exist on the CRM subdomain.
    if (!isMarketingPath(pathname)) {
      return NextResponse.redirect(new URL(`https://${CRM_HOST}${pathname}${search}`, request.url));
    }
    return NextResponse.next();
  }

  // Any other host — localhost/127.0.0.1 in dev, a Vercel preview
  // (*.vercel.app), etc. There's no real subdomain split there, so don't
  // enforce one: redirecting an unrecognized dev/preview host to the
  // production CRM domain would make local dev and PR previews unusable.
  // Both marketing and hub routes are reachable as-is at that one origin.
  return NextResponse.next();
}

// Static files from public/ are shared by both hosts and never go through the
// host routing above. Without this exclusion, a marketing-host request for
// /pwa-icons/* or /brand/* isn't on the allowlist, so it gets redirected to
// the CRM host — and the CSP's `img-src 'self'` blocks that cross-origin
// redirect target. Add any new top-level public/ entry here.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|pwa-icons/|brand/|browserconfig.xml).*)",
  ],
};
