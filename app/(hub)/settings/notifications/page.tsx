import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { initialsFor } from "@/lib/utils";
import { SettingsTabs } from "../_components/SettingsTabs";
import { NotificationsPanel } from "./_components/NotificationsPanel";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const user = await getCurrentUser();

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Notifications"
    >
      <SettingsTabs active="notifications" />
      <NotificationsPanel />
    </HubPage>
  );
}
