import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { initialsFor } from "@/lib/utils";
import { slackService } from "@/modules/slack/slack.service";
import { SettingsTabs } from "../_components/SettingsTabs";
import { SlackPanel } from "./_components/SlackPanel";

export const dynamic = "force-dynamic";

/** Slack: which Slack team and channel feed this workspace, and who has been matched to a login — admins only. */
export default async function IntegrationsSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (workspace.role !== "admin") notFound();
  const { user } = workspace;
  const settings = await slackService.getSettings(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Slack"
    >
      <SettingsTabs active="integrations" />
      <SlackPanel settings={settings} />
    </HubPage>
  );
}
