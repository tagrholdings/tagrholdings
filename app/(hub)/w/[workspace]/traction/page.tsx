import Link from "next/link";
import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { RockBar } from "@/components/traction/traction-ui";
import { tractionService } from "@/modules/traction/traction.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { percent, quarterLabel } from "@/modules/traction/traction.logic";
import { workspacePath } from "@/lib/workspace-path";
import { initialsFor } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { VtoView } from "./_components/VtoView";

export const dynamic = "force-dynamic";

/**
 * Traction's landing page: where the company stands this week (the tiles and the next L10) and where it's going (the
 * V/TO, editable in place). One page, so the plan and the weekly numbers are always read together.
 */
export default async function TractionOverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const [summary, vto, rocksData, issues, members] = await Promise.all([
    tractionService.getSummary(user.tenantId),
    tractionService.getVto(user.tenantId),
    tractionService.getRocks(user.tenantId),
    tractionService.getIssues(user.tenantId),
    tenancyService.listMembers(user.tenantId),
  ]);
  const href = (path: string) => workspacePath(slug, path);
  const topIssues = issues.filter((i) => i.status === "open" && i.horizon === "short_term").slice(0, 3);
  const { scorecard, rocks, todos, lastMeeting } = summary;

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Traction" title="Overview">
      <div data-tour="traction-tiles" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile href={href("/traction/scorecard")} label="Scorecard · latest">
          <span>
            {scorecard.onGoal} <Small>on goal</Small> · <span className="text-destructive">{scorecard.offGoal}</span> <Small>off</Small>
          </span>
          <Sub>{scorecard.total === 0 ? "No measurables yet" : `${scorecard.notEntered} of ${scorecard.total} not entered for the current period`}</Sub>
        </Tile>
        <Tile href={href("/traction/rocks")} label={`Rocks · ${quarterLabel(rocks.quarter)}`}>
          <span>
            {rocks.complete}/{rocks.total} <Small>complete</Small>
          </span>
          <RockBar complete={rocks.complete} onTrack={rocks.onTrack} offTrack={rocks.offTrack} total={rocks.total} />
          <Sub>{rocks.offTrack} off track</Sub>
        </Tile>
        <Tile href={href("/traction/issues")} label="Issues · open">
          <span>{summary.openIssues}</span>
          <Sub>The top 3 go to the next L10</Sub>
        </Tile>
        <Tile href={href("/activities?filter=l10")} label="L10 To-Dos · this week">
          <span>{percent(todos.done, todos.total)}%</span>
          <Sub>
            {todos.done} of {todos.total} done · EOS target is 90%
          </Sub>
        </Tile>
      </div>

      <section data-tour="traction-next-l10" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-divider bg-surface px-4 py-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="label-kicker text-muted-foreground">Next L10 · top issues</p>
          {topIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open issues.</p>
          ) : (
            <ol className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {topIssues.map((issue, i) => (
                <li key={issue.id}>
                  <span className="mr-1.5 font-semibold tabular-nums">{i + 1}.</span>
                  {issue.title}
                </li>
              ))}
            </ol>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {lastMeeting ? `Last L10 ${formatDateUS(lastMeeting.heldAt, { month: "short", day: "numeric" })} · rating ${lastMeeting.averageRating ?? "—"}` : "No L10 recorded yet"}
        </p>
        <Link href={href("/traction/l10")} className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent-hover">
          Start meeting
        </Link>
      </section>

      <VtoView
        content={vto.content}
        updatedAt={vto.updatedAt}
        quarter={rocksData.focusQuarter}
        rocks={rocksData.rocks.filter((r) => r.quarter === rocksData.focusQuarter)}
        longTermIssues={issues.filter((i) => i.horizon === "long_term" && i.status === "open")}
        members={members}
      />
    </HubPage>
  );
}

function Tile({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col gap-1.5 rounded-lg border border-divider bg-surface px-4 py-3 transition-colors hover:border-accent">
      <span className="label-kicker text-muted-foreground">{label}</span>
      <span className="flex flex-col gap-1.5 font-serif text-2xl font-semibold tabular-nums [&>span:first-child]:leading-tight">{children}</span>
    </Link>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return <span className="font-sans text-sm font-normal text-muted-foreground">{children}</span>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <span className="font-sans text-xs font-normal text-muted-foreground">{children}</span>;
}
