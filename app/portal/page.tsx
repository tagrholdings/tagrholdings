import type { Metadata } from "next";
import { OperatingPlaybook } from "@/components/portal/operating-playbook";
import { AccessRequestForm } from "@/components/portal/access-request-form";
import { PortalContact } from "@/components/portal/portal-contact";
import { getPortalAccess, portalHref } from "./_lib/get-portal-access";

// Overrides the root layout's inherited <link rel="manifest"> — see
// app/manifest.ts's comment for why only hub routes advertise the CRM as
// an installable app.
export const metadata: Metadata = { manifest: null };

type PortalSearchParams = { token?: string; next?: string };

export default function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<PortalSearchParams>;
}) {
  return <PortalContent searchParams={searchParams} />;
}

async function PortalContent({
  searchParams,
}: {
  searchParams?: Promise<PortalSearchParams>;
}) {
  const params = await searchParams;
  const { visitor, carriedToken } = await getPortalAccess(params);

  if (!visitor) {
    // `next` is matched against a fixed set, never used as a URL, so it
    // can't be turned into an open redirect.
    return <AccessRequestForm destination={params?.next === "tools" ? "tools" : "playbook"} />;
  }

  return (
    <OperatingPlaybook
      toolsHref={portalHref("/portal/tools", carriedToken)}
      contact={<PortalContact name={visitor.name} email={visitor.email} token={carriedToken} />}
    />
  );
}
