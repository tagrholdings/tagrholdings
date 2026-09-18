import type { Metadata } from "next";
import { verifyAccessToken } from "@/lib/access";
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
  const token = params?.token || "";
  const hasAccess = verifyAccessToken(token);

  if (!hasAccess) {
    return <PortalFallback />;
  }

  return <OperatingPlaybook />;
}
