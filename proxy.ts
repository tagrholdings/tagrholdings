import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { WORKSPACE_HEADER, WORKSPACE_SECTIONS, parseWorkspacePath } from "@/lib/workspace-path";

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

/** Before workspaces the hub lived at `/activities`, `/contacts`… — those old URLs (bookmarks, an installed PWA, old emails) still resolve. */
function isLegacyHubPath(pathname: string) {
  const first = pathname.split("/")[1];
  return (WORKSPACE_SECTIONS as readonly string[]).includes(first);
}

/**
 * Forwards the request with the workspace taken from the URL (`/w/<slug>/…`) in the `x-workspace` header, which is how
 * a Server Action — POSTed to its page's URL — learns which workspace it acts in (lib/safe-action.ts). The header is
 * always rewritten here: a value the client sent is dropped, so it can only ever mirror the URL. It is an address, not
 * proof — every action and page re-checks the person's access to that workspace.
 */
function forward(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const workspace = parseWorkspacePath(request.nextUrl.pathname);
  if (workspace) requestHeaders.set(WORKSPACE_HEADER, workspace.slug);
  else requestHeaders.delete(WORKSPACE_HEADER);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname, search } = request.nextUrl;

  // Shared by both hosts — sign-in only ever happens on the CRM subdomain,
  // but the route itself doesn't need to be redirected either way.
  if (pathname.startsWith("/api/auth")) {
    return forward(request);
  }

  if (isCrmHost(host)) {
    if (pathname === "/") {
      // The hub's home has no route of its own at "/" — app/page.tsx there
      // is already the marketing landing page — so rewrite silently to the
      // resolver, which sends the person to their workspace. The URL bar
      // keeps showing crm.tagrholdings.com/.
      return NextResponse.rewrite(new URL(`/home${search}`, request.url));
    }
    if (isMarketingPath(pathname)) {
      // A marketing-only path has nothing to serve on the CRM host.
      return NextResponse.redirect(
        new URL(`https://www.tagrholdings.com${pathname}${search}`, request.url)
      );
    }
    if (isLegacyHubPath(pathname)) {
      return NextResponse.redirect(new URL(`/home?to=${encodeURIComponent(pathname + search)}`, request.url));
    }
    return forward(request);
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
  if (isLegacyHubPath(pathname)) {
    return NextResponse.redirect(new URL(`/home?to=${encodeURIComponent(pathname + search)}`, request.url));
  }
  return forward(request);
}

// Static files from public/ are shared by both hosts and never go through the
// host routing above. Without this exclusion, a marketing-host request for
// /pwa-icons/* or /brand/* isn't on the allowlist, so it gets redirected to
// the CRM host — and the CSP's `img-src 'self'` blocks that cross-origin
// redirect target. Add any new top-level public/ entry here.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|pwa-icons/|brand/|browserconfig.xml).*)",
  ],
};
