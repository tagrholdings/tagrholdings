import { getWorkspace } from "@/lib/auth-server";
import { inboundAddressFor } from "@/lib/inbound-address";
import { HubPage } from "@/components/layout/HubPage";
import { leadsService } from "@/modules/leads/leads.service";
import { initialsFor } from "@/lib/utils";
import { SourcingTabs } from "../_components/SourcingTabs";
import { InboxView } from "./_components/InboxView";

export const dynamic = "force-dynamic";

/**
 * What the leads inbox received by email, and the businesses for sale the AI read out of each message.
 * `?email=<id>` opens that email beside the list — its text is only loaded for the one being read.
 */
export default async function InboxSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const [{ workspace: slug }, { email: openedId }] = await Promise.all([params, searchParams]);
  const workspace = await getWorkspace(slug);
  const { user } = workspace;
  const [emails, opened] = await Promise.all([
    leadsService.listReceivedEmails(user.tenantId),
    openedId ? leadsService.getReceivedEmail(user.tenantId, openedId) : null,
  ]);

  return (
    <HubPage
      fitViewport
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Sourcing"
      title="Emails"
    >
      <SourcingTabs active="emails" />
      <InboxView emails={emails} opened={opened} inboxAddress={inboundAddressFor(workspace.inboundLocalPart)} />
    </HubPage>
  );
}
