import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { leadsService } from "@/modules/leads/leads.service";
import { initialsFor } from "@/lib/utils";
import { LeadsInboxTabs } from "./_components/LeadsInboxTabs";
import { RawLeadsView } from "./_components/RawLeadsView";

export const dynamic = "force-dynamic";

/**
 * The review queue for what the lead engine discovered (raw leads). "Add to
 * pipeline" promotes one into the managed Leads board (/leads); "Dismiss"
 * only archives it.
 */
export default async function LeadsInboxPage({ searchParams }: { searchParams: Promise<{ lead?: string; add?: string }> }) {
  const [{ lead, add }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const leads = await leadsService.listForTenant(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Lead engine"
      title="Leads Inbox"
    >
      <LeadsInboxTabs active="inbox" />
      <RawLeadsView leads={leads} initialSelectedId={lead ?? null} initialAdd={(add ?? "").slice(0, 5000)} />
    </HubPage>
  );
}
