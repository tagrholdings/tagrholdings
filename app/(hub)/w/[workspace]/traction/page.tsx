import Link from "next/link";
import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { RockBar, RockStatusPill, memberName } from "@/components/traction/traction-ui";
import { tractionService } from "@/modules/traction/traction.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { percent, quarterLabel } from "@/modules/traction/traction.logic";
import { workspacePath } from "@/lib/workspace-path";
import { initialsFor } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";

export const dynamic = "force-dynamic";

const LOOP = [
  { label: "Scorecard", title: "A number misses its goal", text: "The cell turns red." },
  { label: "Rocks", title: "A Rock goes off track", text: "Its owner flips the status." },
  { label: "Issues", title: "One click drops it to Issues", text: "Linked to where it came from." },
  { label: "IDS", title: "The L10 solves the top 3", text: "Identify, Discuss, Solve." },
  { label: "To-Do", title: "Each solution becomes a To-Do", text: "A 7-day commitment, in Activities." },
];

/** Traction's landing page: the company's state on one screen, and how the pieces feed each other. */
export default async function TractionOverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const [summary, rocksData, issues, meetings, members] = await Promise.all([
    tractionService.getSummary(user.tenantId),
    tractionService.getRocks(user.tenantId),
    tractionService.getIssues(user.tenantId),
    tractionService.getMeetings(user.tenantId, 3),
    tenancyService.listMembers(user.tenantId),
  ]);
  const href = (path: string) => workspacePath(slug, path);
  const offTrack = rocksData.rocks.filter((r) => r.quarter === summary.rocks.quarter && r.status === "off_track");
  const topIssues = issues.filter((i) => i.status === "open" && i.horizon === "short_term").slice(0, 3);
  const { scorecard, rocks, todos } = summary;

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

      <section data-tour="traction-loop" className="rounded-lg border border-divider bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-divider px-4 py-3">
          <h2 className="font-serif text-lg font-semibold">How the pieces connect</h2>
          <span className="text-xs text-muted-foreground">Every weekly L10 runs this loop</span>
        </div>
        <ol className="grid gap-px overflow-hidden bg-divider/50 sm:grid-cols-5">
          {LOOP.map((step, i) => (
            <li key={step.label} className="bg-surface px-4 py-3">
              <p className="label-kicker text-accent-text">
                {i + 1} · {step.label}
              </p>
              <p className="mt-1 text-sm font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-divider bg-surface">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <h2 className="font-serif text-lg font-semibold">Off track this quarter</h2>
            <Link href={href("/traction/rocks")} className="text-sm font-medium text-accent-text hover:text-accent-hover">
              All Rocks
            </Link>
          </div>
          {offTrack.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nothing off track. Keep going.</p>
          ) : (
            <ul>
              {offTrack.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 border-b border-divider/50 px-4 py-2.5 last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">{memberName(members, r.ownerUserId) ?? "No owner"}</span>
                  </span>
                  <RockStatusPill status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-divider bg-surface">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <h2 className="font-serif text-lg font-semibold">Next L10</h2>
            <Link href={href("/traction/l10")} className="rounded-pill bg-accent px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent-hover">
              Start meeting
            </Link>
          </div>
          <div className="space-y-3 px-4 py-3 text-sm">
            <div>
              <p className="label-kicker text-muted-foreground">Top issues</p>
              {topIssues.length === 0 ? <p className="text-muted-foreground">No open issues.</p> : (
                <ol className="list-decimal pl-5">
                  {topIssues.map((i) => (
                    <li key={i.id}>{i.title}</li>
                  ))}
                </ol>
              )}
            </div>
            <div>
              <p className="label-kicker text-muted-foreground">Recent meetings</p>
              {meetings.length === 0 ? <p className="text-muted-foreground">No L10 recorded yet.</p> : (
                <ul className="space-y-0.5">
                  {meetings.map((m) => (
                    <li key={m.id} className="flex justify-between gap-3 tabular-nums">
                      <span>{formatDateUS(m.heldAt)}</span>
                      <span className="text-muted-foreground">
                        rating {m.averageRating ?? "—"} · To-Dos {percent(m.todosDone, m.todosTotal)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
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
