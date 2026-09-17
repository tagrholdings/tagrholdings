import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CRM_HOST = "crm.tagrholdings.com";
const MARKETING_HOST = "www.tagrholdings.com";

// The stable, small list of paths that belong to the marketing site — not
// the CRM hub. Everything else defaults to "hub route" on the CRM host and
// gets redirected there from the marketing host. Keeping this list small
// (instead of enumerating every hub path) is what makes this scale as the
// hub grows — see .agents/docs/DOMAINS.md for why.
const MARKETING_PATHS = ["/", "/portal"];
const MARKETING_API_PREFIXES = ["/api/contact"];

function isMarketingPath(pathname: string) {
  return (
    MARKETING_PATHS.includes(pathname) ||
    MARKETING_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export default function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname, search } = request.nextUrl;

  // Shared by both hosts — sign-in only ever happens on the CRM subdomain,
  // but the route itself doesn't need to be redirected either way.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isCrmHost = host === CRM_HOST || host.startsWith("crm.localhost");

  if (isCrmHost) {
    if (pathname === "/") {
      // The hub's home has no route of its own at "/" — app/page.tsx there
      // is already the marketing landing page — so rewrite silently to the
      // real page. The URL bar keeps showing crm.tagrholdings.com/.
      return NextResponse.rewrite(new URL(`/dashboard${search}`, request.url));
    }
    if (isMarketingPath(pathname)) {
      // A marketing-only path has nothing to serve on the CRM host.
      return NextResponse.redirect(new URL(`https://${MARKETING_HOST}${pathname}${search}`, request.url));
    }
    return NextResponse.next();
  }

  // Marketing host (www.tagrholdings.com, or any other domain pointed at
  // this deployment): hub routes only exist on the CRM subdomain.
  if (!isMarketingPath(pathname)) {
    return NextResponse.redirect(new URL(`https://${CRM_HOST}${pathname}${search}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
