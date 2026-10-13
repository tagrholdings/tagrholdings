import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { workspacePath } from "@/lib/workspace-path";
import { checkupBand, formatValue, percent, periodLabel, quarterLabel } from "@/modules/traction/traction.logic";
import { portfolioService } from "@/modules/portfolio/portfolio.service";
import { cn } from "@/lib/utils";
import { TemplateEditor } from "./_components/TemplateEditor";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { tractionService } from "@/modules/traction/traction.service";
import { formatDateUS } from "@/utils/date";

export const metadata: Metadata = { title: "Portfolio - TAGR CRM", manifest: null, robots: { index: false, follow: false } };

// Reads the session — can't be statically rendered.
export const dynamic = "force-dynamic";

/**
 * The super admin's Portfolio: one row per active workspace, fed by each company's Traction (Scorecard, Rocks, Issues,
 * To-Dos, last L10). It's how the owner follows every company without attending any L10. Each row is read through its
 * own workspace's row-level security (tractionService.getPortfolio) — never one query across companies.
 */
export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!(await tenancyService.isSuperAdmin(user.id))) notFound();
  const [rows, comparison] = await Promise.all([tractionService.getPortfolio(), portfolioService.getStandardComparison()]);
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-kicker text-muted-foreground">Platform</p>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Portfolio</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every company&apos;s Traction at a glance. Click a company to open its Overview.</p>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <Link href="/admin" className="text-accent-text hover:text-accent-hover">
              Workspaces
            </Link>
            <Link href="/home" className="text-accent-text hover:text-accent-hover">
              Back to the CRM
            </Link>
          </div>
        </header>

        <section className="overflow-hidden rounded-lg border border-divider bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider">
                  {["Company", "Scorecard", "Rocks", "Open issues", "To-Dos done", "Last L10", "EOS Checkup"].map((h) => (
                    <th key={h} className="label-kicker px-4 py-3 text-left font-normal whitespace-nowrap text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No active workspaces yet.
                    </td>
                  </tr>
                )}
                {rows.map(({ tenantId, slug, name, summary }) => {
                  const todos = percent(summary.todos.done, summary.todos.total);
                  return (
                    <tr key={tenantId} className="border-b border-divider/50 last:border-0">
                      <td className="min-w-[180px] px-4 py-3">
                        <Link href={workspacePath(slug, "/traction")} className="font-medium text-foreground hover:text-accent-text">
                          {name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {summary.scorecard.total === 0 ? (
                          <span className="text-muted-foreground">Not set up</span>
                        ) : (
                          <span className="flex items-center gap-1.5 tabular-nums">
                            <span className="rounded-pill bg-[color-mix(in_srgb,var(--slate)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-400">{summary.scorecard.onGoal}</span>
                            <span className="rounded-pill bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{summary.scorecard.offGoal}</span>
                            {summary.scorecard.notEntered > 0 && <span className="text-xs text-muted-foreground">{summary.scorecard.notEntered} not entered</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {summary.rocks.total === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <>
                            {summary.rocks.complete}/{summary.rocks.total} <span className="text-xs text-muted-foreground">{quarterLabel(summary.rocks.quarter)}</span>
                            {summary.rocks.offTrack > 0 && <span className="ml-2 rounded-pill bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{summary.rocks.offTrack} off</span>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{summary.openIssues}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {summary.todos.total === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={todos >= 90 ? "text-green-800 dark:text-green-400" : todos < 70 ? "text-destructive" : undefined}>{todos}%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {summary.lastMeeting ? (
                          <>
                            {formatDateUS(summary.lastMeeting.heldAt, { month: "short", day: "numeric" })}
                            <span className="ml-1 text-xs text-muted-foreground">rating {summary.lastMeeting.averageRating ?? "—"}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">None yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {summary.checkup ? (
                          summary.checkup.count > 1 ? (
                            <>
                              {summary.checkup.kickoff}% → <span className="font-medium">{summary.checkup.latest}%</span>{" "}
                              <span className={summary.checkup.latest >= summary.checkup.kickoff ? "text-green-800 dark:text-green-400" : "text-destructive"}>
                                {summary.checkup.latest >= summary.checkup.kickoff ? "+" : ""}
                                {summary.checkup.latest - summary.checkup.kickoff}
                              </span>
                            </>
                          ) : (
                            <>
                              {summary.checkup.kickoff}% <span className="text-xs text-muted-foreground">{checkupBand(summary.checkup.kickoff).label.toLowerCase()} · kickoff</span>
                            </>
                          )
                        ) : (
                          <span className="text-muted-foreground">Not taken</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {comparison.template.length > 0 && (
          <section className="overflow-hidden rounded-lg border border-divider bg-surface">
            <p className="label-kicker border-b border-divider px-4 py-2 text-muted-foreground">Standard numbers · each company&apos;s latest</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divider">
                    <th className="label-kicker px-4 py-3 text-left font-normal text-muted-foreground">Company</th>
                    {comparison.template.map((t) => (
                      <th key={t.name} className="label-kicker px-4 py-3 text-right font-normal whitespace-nowrap text-muted-foreground">
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.tenantId} className="border-b border-divider/50 last:border-0">
                      <td className="min-w-[160px] px-4 py-3">
                        <Link href={workspacePath(row.slug, "/traction/scorecard")} className="font-medium hover:text-accent-text">
                          {row.name}
                        </Link>
                      </td>
                      {row.numbers.map((n, i) => (
                        <td key={n.name} className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                          {!n.tracked ? (
                            <span className="text-xs text-muted-foreground italic">not tracked</span>
                          ) : n.value === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={cn("rounded-sm px-2 py-0.5", n.met === true && "bg-[color-mix(in_srgb,var(--slate)_14%,transparent)] text-green-800 dark:text-green-400", n.met === false && "bg-destructive/10 text-destructive")}>
                              {formatValue(n.value, n.unit)}
                              {n.periodStart && <span className="ml-1 text-[11px] text-muted-foreground">{periodLabel(n.periodStart, comparison.template[i].cadence, year)}</span>}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <TemplateEditor template={comparison.template} />

        <p className="text-xs text-muted-foreground">
          To-Dos: green at 90% or more (the EOS target), red under 70%. Scorecard counts each measurable&apos;s latest number against its goal.
        </p>
      </div>
    </div>
  );
}
