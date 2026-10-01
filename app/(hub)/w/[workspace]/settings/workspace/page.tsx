import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/auth-server";
import { inboundAddressFor } from "@/lib/inbound-address";
import { HubPage } from "@/components/layout/HubPage";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { initialsFor } from "@/lib/utils";
import { SettingsTabs } from "../_components/SettingsTabs";
import { WorkspacePanel } from "./_components/WorkspacePanel";

export const dynamic = "force-dynamic";

/** The workspace's own leads-inbox address and who its email signups sign up as — admins only. */
export default async function WorkspaceSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (workspace.role !== "admin") notFound();
  const { user } = workspace;
  const tenant = await tenancyService.getTenant(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Workspace"
    >
      <SettingsTabs active="workspace" />
      <WorkspacePanel
        name={workspace.name}
        inboundAddress={inboundAddressFor(workspace.inboundLocalPart)}
        buyer={{ buyerName: tenant?.buyerName ?? "", buyerPhone: tenant?.buyerPhone ?? "", buyerCompany: tenant?.buyerCompany ?? "" }}
      />
    </HubPage>
  );
}
