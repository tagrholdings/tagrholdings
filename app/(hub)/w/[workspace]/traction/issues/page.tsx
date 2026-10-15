import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { initialsFor } from "@/lib/utils";
import { IssuesView } from "./_components/IssuesView";

export const dynamic = "force-dynamic";

/** The Issues List — open issues of both lists (L10 / V/TO), plus what was closed this week. */
export default async function IssuesPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ list?: string }> }) {
  const [{ workspace: slug }, query] = await Promise.all([params, searchParams]);
  const { user } = await getWorkspace(slug);
  const [issues, members, checks] = await Promise.all([tractionService.getIssues(user.tenantId), tractionService.listOwners(user.tenantId), tractionService.getRuleChecks(user.tenantId)]);

  return (
    <HubPage fitViewport user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Traction" title="Issues">
      <IssuesView issues={issues} members={members} checks={checks.filter((c) => c.area === "issues")} initialHorizon={query.list === "long_term" ? "long_term" : "short_term"} />
    </HubPage>
  );
}
