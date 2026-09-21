import "server-only";
import { cookies } from "next/headers";
import { portalAccessService } from "@/modules/portal-access/portal-access.service";
import { PORTAL_ACCESS_COOKIE } from "@/modules/portal-access/portal-access.constants";

/**
 * Shared by every /portal page so the gate behaves identically on each.
 *
 * The cookie (set right after a successful access request, see
 * portal-access.actions.ts) is checked first so a returning visitor skips the
 * form entirely; the query token keeps the emailed link working on a device
 * that never got the cookie.
 *
 * `visitor` is who the token was granted to (null without access) — the
 * contact modal pre-fills from it.
 *
 * `carriedToken` is only set when access came from the query token — the one
 * case where a plain link to another portal page would drop access, so
 * in-portal links must carry the token along (see `portalHref`), and the
 * contact modal must send it back since there is no cookie to read.
 */
export async function getPortalAccess(params?: { token?: string }) {
  const cookieToken = (await cookies()).get(PORTAL_ACCESS_COOKIE)?.value;
  const token = cookieToken || params?.token || "";
  const visitor = await portalAccessService.findVisitor(token);

  return {
    hasAccess: visitor !== null,
    visitor,
    carriedToken: visitor && !cookieToken ? token : null,
  };
}

export function portalHref(path: string, carriedToken: string | null) {
  return carriedToken ? `${path}?token=${encodeURIComponent(carriedToken)}` : path;
}
