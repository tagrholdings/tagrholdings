import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { invitesService } from "@/modules/invites/invites.service";
import { initialsFor } from "@/lib/utils";
import { SettingsTabs } from "../_components/SettingsTabs";
import { InvitesView } from "./_components/InvitesView";

export const dynamic = "force-dynamic";

export default async function InvitesSettingsPage() {
  const user = await getCurrentUser();
  const invites = await invitesService.listForTenant(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Invites"
    >
      <SettingsTabs active="invites" />
      <InvitesView invites={invites} />
    </HubPage>
  );
}
