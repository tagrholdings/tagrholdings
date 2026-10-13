import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { isQuarter } from "@/modules/traction/traction.logic";
import { initialsFor } from "@/lib/utils";
import { RocksView } from "./_components/RocksView";

export const dynamic = "force-dynamic";

/** Rocks — the 90-day priorities, one quarter at a time (`?quarter=2026-Q3`). */
export default async function RocksPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ quarter?: string }> }) {
  const [{ workspace: slug }, query] = await Promise.all([params, searchParams]);
  const { user } = await getWorkspace(slug);
  const [{ rocks, focusQuarter, currentQuarter }, members, vto, checks] = await Promise.all([
    tractionService.getRocks(user.tenantId),
    tractionService.listOwners(user.tenantId),
    tractionService.getVto(user.tenantId),
    tractionService.getRuleChecks(user.tenantId),
  ]);
  const quarter = query.quarter && isQuarter(query.quarter) ? query.quarter : focusQuarter;

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Traction" title="Rocks">
      <RocksView rocks={rocks} quarter={quarter} currentQuarter={currentQuarter} members={members} goals={vto.content.oneYear.goals} checks={checks.filter((c) => c.area === "rocks")} />
    </HubPage>
  );
}
