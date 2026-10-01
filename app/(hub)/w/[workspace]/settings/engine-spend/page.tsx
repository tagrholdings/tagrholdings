import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { initialsFor } from "@/lib/utils";
import { SettingsTabs } from "../_components/SettingsTabs";
import { SpendReportView } from "../_components/SpendReportView";

export const dynamic = "force-dynamic";

export default async function EngineSpendSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (workspace.role !== "admin") notFound();
  const { user } = workspace;
  const report = await leadEngineService.getSpendReport(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Engine spend"
    >
      <SettingsTabs active="engine-spend" />
      <SpendReportView report={report} />
    </HubPage>
  );
}
