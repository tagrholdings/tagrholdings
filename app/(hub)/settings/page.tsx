import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { initialsFor } from "@/lib/utils";
import { SpendReportView } from "./_components/SpendReportView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const report = await leadEngineService.getSpendReport(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Workspace"
      title="Settings"
    >
      <section aria-labelledby="engine-spend-heading" className="flex min-w-0 flex-col gap-4">
        <div>
          <h2 id="engine-spend-heading" className="font-serif text-xl font-semibold text-foreground">
            Engine spend
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">What the lead engine has cost so far, itemized.</p>
        </div>
        <SpendReportView report={report} />
      </section>
    </HubPage>
  );
}
