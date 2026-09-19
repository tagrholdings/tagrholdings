import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { searchProfilesService } from "@/modules/search-profiles/search-profiles.service";
import { initialsFor } from "@/lib/utils";
import { LeadsInboxTabs } from "../_components/LeadsInboxTabs";
import { ProfilesView } from "./_components/ProfilesView";

export const dynamic = "force-dynamic";

export default async function SearchProfilesPage() {
  const user = await getCurrentUser();
  const profiles = await searchProfilesService.listForTenant(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Lead engine"
      title="Search profiles"
    >
      <LeadsInboxTabs active="profiles" />
      <ProfilesView profiles={profiles} />
    </HubPage>
  );
}
