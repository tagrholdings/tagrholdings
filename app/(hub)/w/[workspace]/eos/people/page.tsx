import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { isQuarter, quarterOf, todayIso } from "@/modules/traction/traction.logic";
import { initialsFor } from "@/lib/utils";
import { PeopleView } from "./_components/PeopleView";

export const dynamic = "force-dynamic";

/**
 * EOS People: the Accountability Chart (who sits in which seat — everyone sees it) and the People Analyzer (private:
 * the person, their manager and the workspace admins only — see tractionService.getPeopleAnalyzer).
 */
export default async function PeoplePage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ tab?: string; quarter?: string }> }) {
  const [{ workspace: slug }, query] = await Promise.all([params, searchParams]);
  const { user, role } = await getWorkspace(slug);
  const quarter = query.quarter && isQuarter(query.quarter) ? query.quarter : quarterOf(todayIso());
  const isAdmin = role === "admin";
  const [seats, members, analyzer, checks] = await Promise.all([
    tractionService.getSeats(user.tenantId),
    tractionService.listOwners(user.tenantId),
    tractionService.getPeopleAnalyzer(user.tenantId, user.id, isAdmin, quarter),
    tractionService.getRuleChecks(user.tenantId),
  ]);

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="EOS · People" title="People">
      <PeopleView
        initialTab={query.tab === "analyzer" ? "analyzer" : "chart"}
        seats={seats}
        members={members}
        isAdmin={isAdmin}
        quarter={quarter}
        analyzer={analyzer}
        checks={checks.filter((c) => c.area === "people")}
      />
    </HubPage>
  );
}
