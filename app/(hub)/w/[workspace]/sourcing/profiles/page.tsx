import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { searchProfilesService } from "@/modules/search-profiles/search-profiles.service";
import { initialsFor } from "@/lib/utils";
import { SourcingTabs } from "../_components/SourcingTabs";
import { ProfilesView } from "./_components/ProfilesView";

export const dynamic = "force-dynamic";

export default async function SearchProfilesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const profiles = await searchProfilesService.listForTenant(user.tenantId);

  return (
    <HubPage
      fitViewport
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Sourcing"
      title="Search profiles"
    >
      <SourcingTabs active="profiles" />
      <ProfilesView profiles={profiles} />
    </HubPage>
  );
}
