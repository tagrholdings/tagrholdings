import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { initialsFor } from "@/lib/utils";
import { L10View } from "./_components/L10View";

export const dynamic = "force-dynamic";

/** The weekly Level 10 meeting, run from the CRM: the agenda on the left, live data for each step on the right. */
export default async function L10Page({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const [data, members] = await Promise.all([tractionService.getMeetingData(user.tenantId), tenancyService.listMembers(user.tenantId)]);

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Traction · Weekly" title="L10 Meeting">
      <L10View {...data} members={members} />
    </HubPage>
  );
}
