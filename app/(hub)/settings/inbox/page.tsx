import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { leadsService } from "@/modules/leads/leads.service";
import { initialsFor } from "@/lib/utils";
import { SettingsTabs } from "../_components/SettingsTabs";
import { InboxView } from "./_components/InboxView";

export const dynamic = "force-dynamic";

/** What the leads inbox received by email, and the businesses for sale the AI read out of each message. */
export default async function InboxSettingsPage() {
  const user = await getCurrentUser();
  const emails = await leadsService.listReceivedEmails(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Inbox"
    >
      <SettingsTabs active="inbox" />
      <InboxView emails={emails} inboxAddress={process.env.INBOUND_LEADS_ADDRESS?.trim() || null} />
    </HubPage>
  );
}
