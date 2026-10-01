import { getWorkspace } from "@/lib/auth-server";
import { inboundAddressFor } from "@/lib/inbound-address";
import { HubPage } from "@/components/layout/HubPage";
import { leadsService } from "@/modules/leads/leads.service";
import { initialsFor } from "@/lib/utils";
import { SettingsTabs } from "../_components/SettingsTabs";
import { InboxView } from "./_components/InboxView";

export const dynamic = "force-dynamic";

/** What the leads inbox received by email, and the businesses for sale the AI read out of each message. */
export default async function InboxSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  const { user } = workspace;
  const emails = await leadsService.listReceivedEmails(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Inbox"
    >
      <SettingsTabs active="inbox" />
      <InboxView emails={emails} inboxAddress={inboundAddressFor(workspace.inboundLocalPart)} />
    </HubPage>
  );
}
