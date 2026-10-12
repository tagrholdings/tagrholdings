import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { todayIso, type Cadence } from "@/modules/traction/traction.logic";
import { initialsFor } from "@/lib/utils";
import { ScorecardView } from "./_components/ScorecardView";

export const dynamic = "force-dynamic";

/** The Scorecard: every measurable of one cadence over the last 13 weeks / 6 months (`?end=` pages back in time). */
export default async function ScorecardPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ cadence?: string; end?: string }> }) {
  const [{ workspace: slug }, query] = await Promise.all([params, searchParams]);
  const { user } = await getWorkspace(slug);
  const cadence: Cadence = query.cadence === "weekly" ? "weekly" : "monthly";
  const today = todayIso();
  const end = query.end && /^\d{4}-\d{2}-\d{2}$/.test(query.end) && query.end < today ? query.end : today;

  const [scorecard, members] = await Promise.all([tractionService.getScorecard(user.tenantId, cadence, end), tenancyService.listMembers(user.tenantId)]);

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Traction" title="Scorecard">
      <ScorecardView key={`${cadence}:${end}`} cadence={cadence} windowEnd={end} today={today} {...scorecard} members={members} />
    </HubPage>
  );
}
