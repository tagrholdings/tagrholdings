import type { Metadata } from "next";
import { cookies } from "next/headers";
import { portalAccessService } from "@/modules/portal-access/portal-access.service";
import { PORTAL_ACCESS_COOKIE } from "@/modules/portal-access/portal-access.constants";
import { OperatingPlaybook } from "@/components/portal/operating-playbook";
import { AccessRequestForm } from "@/components/portal/access-request-form";

// Overrides the root layout's inherited <link rel="manifest"> — see
// app/manifest.ts's comment for why only hub routes advertise the CRM as
// an installable app.
export const metadata: Metadata = { manifest: null };

function PortalFallback() {
  return <AccessRequestForm />;
}

export default function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  return <PortalContent searchParams={searchParams} />;
}

async function PortalContent({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  // The cookie (set right after a successful access request, see
  // portal-access.actions.ts) is checked first so a returning visitor skips
  // the form entirely; the query token keeps the emailed link working on a
  // device that never got the cookie.
  const token = cookieStore.get(PORTAL_ACCESS_COOKIE)?.value || params?.token || "";
  const hasAccess = await portalAccessService.verifyToken(token);

  if (!hasAccess) {
    return <PortalFallback />;
  }

  return <OperatingPlaybook />;
}
