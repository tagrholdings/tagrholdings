import Link from "next/link";
import { History } from "lucide-react";
import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { tractionService } from "@/modules/traction/traction.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { memberName, percent } from "@/modules/traction/traction.logic";
import { workspacePath } from "@/lib/workspace-path";
import { cn, initialsFor } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";

export const dynamic = "force-dynamic";

/** Every concluded L10, newest first: the snapshot each Conclude recorded, who rated what, and the headlines. */
export default async function L10HistoryPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const [meetings, members] = await Promise.all([tractionService.getMeetingHistory(user.tenantId), tenancyService.listMembers(user.tenantId)]);
  const rated = meetings.filter((m) => m.averageRating !== null);
  const overall = rated.length ? Math.round((rated.reduce((sum, m) => sum + (m.averageRating ?? 0), 0) / rated.length) * 10) / 10 : null;

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Traction · L10"
      title="Meeting history"
      backHref={workspacePath(slug, "/traction/l10")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted-foreground">
          {meetings.length === 0 ? "No meetings recorded yet." : `${meetings.length} meeting${meetings.length === 1 ? "" : "s"} · average rating ${overall ?? "—"}`}
        </p>
        <Link href={workspacePath(slug, "/traction/l10")} className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent-hover">
          Back to the meeting
        </Link>
      </div>

      {meetings.length === 0 ? (
        <Empty data-tour="l10-history-list" className="border border-dashed border-divider">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>No L10 recorded yet</EmptyTitle>
            <EmptyDescription>Each time a meeting is concluded, its numbers, ratings and headlines are kept here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol data-tour="l10-history-list" className="flex flex-col gap-3">
          {meetings.map((m) => {
            const todos = percent(m.todosDone, m.todosTotal);
            return (
              <li key={m.id} className="rounded-lg border border-divider bg-surface">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-divider px-4 py-3">
                  <h2 className="font-serif text-base font-semibold">{formatDateUS(m.heldAt, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</h2>
                  <span className="text-sm text-muted-foreground">
                    Rating <span className="font-serif text-lg font-semibold text-foreground tabular-nums">{m.averageRating ?? "—"}</span>
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-4">
                  <Stat label="To-Dos done" value={m.todosTotal ? `${todos}%` : "—"} tone={m.todosTotal ? (todos >= 90 ? "good" : todos < 70 ? "bad" : undefined) : undefined} />
                  <Stat label="Issues solved" value={String(m.issuesSolved)} />
                  <Stat label="Rocks off track" value={String(m.rocksOffTrack)} tone={m.rocksOffTrack > 0 ? "bad" : undefined} />
                  <Stat label="Off goal" value={String(m.measurablesOffGoal)} tone={m.measurablesOffGoal > 0 ? "bad" : undefined} />
                </dl>
                {(Object.keys(m.ratings).length > 0 || m.headlines) && (
                  <div className="flex flex-col gap-2 border-t border-divider/50 px-4 py-3 text-sm">
                    {Object.keys(m.ratings).length > 0 && (
                      <p className="flex flex-wrap gap-x-4 gap-y-1">
                        {Object.entries(m.ratings).map(([userId, rating]) => (
                          <span key={userId}>
                            <span className="text-muted-foreground">{memberName(members, userId) ?? "Former member"}</span> <span className="font-medium tabular-nums">{rating}</span>
                          </span>
                        ))}
                      </p>
                    )}
                    {m.headlines && <p className="whitespace-pre-line text-muted-foreground">{m.headlines}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </HubPage>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-serif text-xl font-semibold tabular-nums", tone === "good" && "text-green-800 dark:text-green-400", tone === "bad" && "text-destructive")}>{value}</dd>
    </div>
  );
}
