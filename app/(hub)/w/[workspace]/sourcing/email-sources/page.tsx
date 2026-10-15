import { getWorkspace } from "@/lib/auth-server";
import { inboundAddressFor } from "@/lib/inbound-address";
import { HubPage } from "@/components/layout/HubPage";
import { emailSourcesService } from "@/modules/email-sources/email-sources.service";
import { initialsFor } from "@/lib/utils";
import { SourcingTabs } from "../_components/SourcingTabs";
import { EmailSourcesView } from "./_components/EmailSourcesView";

export const dynamic = "force-dynamic";

/** Listing sites that deliver by email: which ones are on the list, and which the inbox is actually subscribed to. */
export default async function EmailSourcesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  const { user } = workspace;
  const sources = await emailSourcesService.listForTenant(user.tenantId);

  return (
    <HubPage
      fitViewport
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Sourcing"
      title="Email sources"
    >
      <SourcingTabs active="email-sources" />
      <EmailSourcesView sources={sources} inboxAddress={inboundAddressFor(workspace.inboundLocalPart)} />
    </HubPage>
  );
}
