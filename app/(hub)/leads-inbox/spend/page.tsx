import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { initialsFor } from "@/lib/utils";
import { LeadsInboxTabs } from "../_components/LeadsInboxTabs";
import { SpendReportView } from "./_components/SpendReportView";

export const dynamic = "force-dynamic";

export default async function EngineSpendPage() {
  const user = await getCurrentUser();
  const report = await leadEngineService.getSpendReport(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Lead engine"
      title="Engine spend"
    >
      <LeadsInboxTabs active="spend" />
      <SpendReportView report={report} />
    </HubPage>
  );
}
