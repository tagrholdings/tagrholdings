import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { initialsFor } from "@/lib/utils";
import { SettingsTabs } from "../_components/SettingsTabs";
import { ApplicationPanel } from "./_components/ApplicationPanel";

export const dynamic = "force-dynamic";

export default async function ApplicationSettingsPage() {
  const user = await getCurrentUser();

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Application"
    >
      <SettingsTabs active="application" />
      <ApplicationPanel />
    </HubPage>
  );
}
