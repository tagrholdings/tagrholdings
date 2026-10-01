import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { listingSitesService } from "@/modules/listing-sites/listing-sites.service";
import { initialsFor } from "@/lib/utils";
import { LeadsInboxTabs } from "../_components/LeadsInboxTabs";
import { ListingSitesView } from "./_components/ListingSitesView";

export const dynamic = "force-dynamic";

/** The business brokers' websites the engine reads for businesses that are for sale — found by the engine or added by hand. */
export default async function ListingSitesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const sites = await listingSitesService.listForTenant(user.tenantId);

  return (
    <HubPage
      fitViewport
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Lead engine"
      title="Listing sites"
    >
      <LeadsInboxTabs active="listing-sites" />
      <ListingSitesView sites={sites} />
    </HubPage>
  );
}
