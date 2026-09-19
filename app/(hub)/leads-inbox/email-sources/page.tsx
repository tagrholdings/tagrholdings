import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { emailSourcesService } from "@/modules/email-sources/email-sources.service";
import { initialsFor } from "@/lib/utils";
import { LeadsInboxTabs } from "../_components/LeadsInboxTabs";
import { EmailSourcesView } from "./_components/EmailSourcesView";

export const dynamic = "force-dynamic";

/** Listing sites that deliver by email: which ones are on the list, and which the inbox is actually subscribed to. */
export default async function EmailSourcesPage() {
  const user = await getCurrentUser();
  const sources = await emailSourcesService.listForTenant(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Lead engine"
      title="Email sources"
    >
      <LeadsInboxTabs active="email-sources" />
      <EmailSourcesView sources={sources} inboxAddress={process.env.INBOUND_LEADS_ADDRESS?.trim() || null} />
    </HubPage>
  );
}
