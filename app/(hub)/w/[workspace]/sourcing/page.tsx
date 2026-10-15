import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { leadsService } from "@/modules/leads/leads.service";
import { initialsFor } from "@/lib/utils";
import { SourcingTabs } from "./_components/SourcingTabs";
import { RawLeadsView } from "./_components/RawLeadsView";

export const dynamic = "force-dynamic";

/**
 * The review queue for what the lead engine discovered (raw leads). "Add to
 * pipeline" promotes one into the managed Leads board (/leads); "Dismiss"
 * only archives it.
 */
export default async function LeadsInboxPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ lead?: string; add?: string }> }) {
  const [{ lead, add }, { workspace: slug }] = await Promise.all([searchParams, params]);
  const { user } = await getWorkspace(slug);
  const leads = await leadsService.listForTenant(user.tenantId);

  return (
    <HubPage
      fitViewport
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Sourcing"
      title="Review"
    >
      <SourcingTabs active="review" />
      <RawLeadsView leads={leads} initialSelectedId={lead ?? null} initialAdd={(add ?? "").slice(0, 5000)} />
    </HubPage>
  );
}
