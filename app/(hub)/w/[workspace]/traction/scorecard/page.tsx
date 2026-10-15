import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { portfolioService } from "@/modules/portfolio/portfolio.service";
import { todayIso, type Cadence } from "@/modules/traction/traction.logic";
import { initialsFor } from "@/lib/utils";
import { ScorecardView } from "./_components/ScorecardView";

export const dynamic = "force-dynamic";

/** The Scorecard: every measurable of one cadence over the last 13 weeks / 6 months (`?end=` pages back in time). */
export default async function ScorecardPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ cadence?: string; end?: string }> }) {
  const [{ workspace: slug }, query] = await Promise.all([params, searchParams]);
  const { user } = await getWorkspace(slug);
  // No choice in the URL → weekly (the EOS default), unless the workspace only has monthly numbers.
  const cadence: Cadence = query.cadence === "weekly" || query.cadence === "monthly" ? query.cadence : await tractionService.defaultCadence(user.tenantId);
  const today = todayIso();
  const end = query.end && /^\d{4}-\d{2}-\d{2}$/.test(query.end) && query.end < today ? query.end : today;

  const [scorecard, members, checks, template] = await Promise.all([
    tractionService.getScorecard(user.tenantId, cadence, end),
    tractionService.listOwners(user.tenantId),
    tractionService.getRuleChecks(user.tenantId),
    portfolioService.getTemplate(),
  ]);
  const missingStandard = await tractionService.missingStandardMeasurables(user.tenantId, template);

  return (
    <HubPage fitViewport user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Traction" title="Scorecard">
      <ScorecardView key={`${cadence}:${end}`} cadence={cadence} windowEnd={end} today={today} {...scorecard} members={members} checks={checks.filter((c) => c.area === "scorecard")} missingStandard={missingStandard.map((m) => m.name)} />
    </HubPage>
  );
}
