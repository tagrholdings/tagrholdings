import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalContact } from "@/components/portal/portal-contact";
import { PortalTools, type PortalToolId } from "@/components/portal/portal-tools";
import { getPortalAccess, portalHref } from "../_lib/get-portal-access";

// Same reason as app/portal/page.tsx.
export const metadata: Metadata = { title: "Tools", manifest: null };

type ToolsSearchParams = { token?: string; tool?: string };

export default function PortalToolsPage({
  searchParams,
}: {
  searchParams?: Promise<ToolsSearchParams>;
}) {
  return <ToolsContent searchParams={searchParams} />;
}

async function ToolsContent({
  searchParams,
}: {
  searchParams?: Promise<ToolsSearchParams>;
}) {
  const params = await searchParams;
  const { visitor, carriedToken } = await getPortalAccess(params);

  // No access: send the visitor through the same form as /portal, which
  // brings them straight back here once they submit.
  if (!visitor) redirect("/portal?next=tools");

  const initialTool: PortalToolId = params?.tool === "urgency" ? "urgency" : "eos";

  return (
    <PortalTools
      initialTool={initialTool}
      playbookHref={portalHref("/portal", carriedToken)}
      toolsHref={portalHref("/portal/tools", carriedToken)}
      contact={<PortalContact name={visitor.name} email={visitor.email} token={carriedToken} />}
    />
  );
}
