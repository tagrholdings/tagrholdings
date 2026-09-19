import { Coins } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { formatCount, formatUsd } from "@/utils/money";
import { OPERATION_LABELS, PROVIDER_LABELS } from "@/modules/lead-engine/lead-engine.constants";
import type { UsageProvider } from "@/modules/lead-engine/lead-engine.schema";
import type { RunRow, SpendReport } from "@/modules/lead-engine/lead-engine.types";
import { SpendStrip } from "../../_components/SpendStrip";

const RUN_STATUS_LABELS: Record<RunRow["status"], string> = {
  running: "Running",
  completed: "Completed",
  partial: "Stopped early",
  failed: "Failed",
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-divider bg-surface p-5">
      <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Horizontal share bar — width is the share of the largest value, so the top row always fills the track. */
function ShareBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="h-2 w-full min-w-16 rounded-pill bg-muted" aria-hidden>
      <div className="h-full rounded-pill bg-accent" style={{ width: `${width}%` }} />
    </div>
  );
}

function DailyChart({ daily }: { daily: SpendReport["daily"] }) {
  const max = Math.max(...daily.map((d) => d.costUsd), 0);
  const total = daily.reduce((sum, d) => sum + d.costUsd, 0);
  return (
    <div>
      <div
        role="img"
        aria-label={`Daily spend, last ${daily.length} days: ${formatUsd(total)} in total, highest day ${formatUsd(max)}.`}
        className="flex h-32 items-end gap-1"
      >
        {daily.map((day) => (
          <div key={day.date} className="flex h-full flex-1 items-end" title={`${day.date}: ${formatUsd(day.costUsd)}`}>
            <div
              className={cn("w-full rounded-t-sm", day.costUsd > 0 ? "bg-accent" : "bg-muted")}
              style={{ height: max > 0 ? `${Math.max((day.costUsd / max) * 100, day.costUsd > 0 ? 3 : 1.5)}%` : "1.5%" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{formatDateUS(daily[0].date + "T12:00:00", { month: "short", day: "numeric" })}</span>
        <span>Highest day {formatUsd(max)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function ScrollTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-divider bg-background">{children}</div>;
}

const th = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground";
const td = "px-4 py-3 text-sm";

/**
 * The full "where did the money go" report. A Server Component: it only
 * renders numbers the service already aggregated — no interactivity needed.
 * Every amount is the engine's estimate at list price (see lead-engine.schema.ts).
 */
export function SpendReportView({ report }: { report: SpendReport }) {
  const { totals, lines, byProfile, daily, runs } = report;

  if (lines.length === 0 && runs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Coins />
          </EmptyMedia>
          <EmptyTitle>No spend yet</EmptyTitle>
          <EmptyDescription>
            Every paid call the lead engine makes — Google Places, Brave Search, AI extraction — is logged here with its estimated cost once it has run.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const providerTotals = new Map<UsageProvider, { costUsd: number; requests: number }>();
  for (const line of lines) {
    const current = providerTotals.get(line.provider) ?? { costUsd: 0, requests: 0 };
    providerTotals.set(line.provider, { costUsd: current.costUsd + line.costUsd, requests: current.requests + line.requests });
  }
  const providers = [...providerTotals.entries()].sort((a, b) => b[1].costUsd - a[1].costUsd);
  const maxProvider = Math.max(...providers.map(([, v]) => v.costUsd), 0);

  return (
    <div className="space-y-6">
      <SpendStrip totals={totals} showLink={false} />

      <p className="max-w-prose text-sm text-muted-foreground">
        Amounts are estimates at each provider&rsquo;s list price, calculated when each call is made. They don&rsquo;t subtract free monthly
        allowances or credits, so your actual invoice can be lower — check Google Cloud Billing, the Brave Search API dashboard, the OpenAI usage page and your Resend plan (received emails count toward its monthly quota; there is no separate per-email price) for the real figures.
      </p>

      <Section title="By service" description="Which provider the money went to.">
        <ul className="space-y-3">
          {providers.map(([provider, value]) => (
            <li key={provider} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[14rem_1fr_auto]">
              <span className="text-sm font-medium text-foreground">{PROVIDER_LABELS[provider] ?? provider}</span>
              <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                <ShareBar value={value.costUsd} max={maxProvider} />
              </span>
              <span className="text-right text-sm tabular-nums text-foreground">
                {formatUsd(value.costUsd)}
                <span className="ml-2 text-xs text-muted-foreground">{formatCount(value.requests)} calls</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Detail" description="Every kind of call, with volume and cost. AI calls also show the tokens used.">
        <ScrollTable>
          <table className="w-full min-w-[40rem]">
            <thead className="border-b border-divider">
              <tr>
                <th className={th}>Service</th>
                <th className={th}>What for</th>
                <th className={cn(th, "text-right")}>Calls</th>
                <th className={cn(th, "text-right")}>Tokens in / out</th>
                <th className={cn(th, "text-right")}>Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {lines.map((line) => (
                <tr key={`${line.provider}:${line.operation}:${line.model ?? ""}`}>
                  <td className={cn(td, "font-medium text-foreground")}>{PROVIDER_LABELS[line.provider] ?? line.provider}</td>
                  <td className={cn(td, "text-muted-foreground")}>
                    {OPERATION_LABELS[line.operation] ?? line.operation}
                    {line.model && <span className="block text-xs">{line.model}</span>}
                  </td>
                  <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>{formatCount(line.requests)}</td>
                  <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>
                    {line.inputTokens || line.outputTokens ? `${formatCount(line.inputTokens)} / ${formatCount(line.outputTokens)}` : "—"}
                  </td>
                  <td className={cn(td, "text-right tabular-nums font-medium text-foreground")}>{formatUsd(line.costUsd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-divider">
              <tr>
                <td className={cn(td, "font-medium text-foreground")} colSpan={4}>
                  Total
                </td>
                <td className={cn(td, "text-right tabular-nums font-semibold text-foreground")}>{formatUsd(totals.totalUsd)}</td>
              </tr>
            </tfoot>
          </table>
        </ScrollTable>
      </Section>

      <Section title="Last 30 days" description="Estimated spend per day (UTC).">
        <DailyChart daily={daily} />
      </Section>

      {byProfile.length > 0 && (
        <Section title="By search profile" description="Which searches are worth what they cost.">
          <ScrollTable>
            <table className="w-full min-w-[32rem]">
              <thead className="border-b border-divider">
                <tr>
                  <th className={th}>Profile</th>
                  <th className={cn(th, "text-right")}>Runs</th>
                  <th className={cn(th, "text-right")}>Leads found</th>
                  <th className={cn(th, "text-right")}>Per lead</th>
                  <th className={cn(th, "text-right")}>Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {byProfile.map((profile) => (
                  <tr key={profile.searchProfileId}>
                    <td className={cn(td, "font-medium text-foreground")}>{profile.searchProfileName}</td>
                    <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>{formatCount(profile.runs)}</td>
                    <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>{formatCount(profile.leadsAdded)}</td>
                    <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>
                      {profile.leadsAdded > 0 ? formatUsd(profile.costUsd / profile.leadsAdded) : "—"}
                    </td>
                    <td className={cn(td, "text-right tabular-nums font-medium text-foreground")}>{formatUsd(profile.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </Section>
      )}

      {runs.length > 0 && (
        <Section title="Recent runs" description="The last runs of the engine and what each one cost.">
          <ScrollTable>
            <table className="w-full min-w-[48rem]">
              <thead className="border-b border-divider">
                <tr>
                  <th className={th}>Started</th>
                  <th className={th}>Profile</th>
                  <th className={th}>Status</th>
                  <th className={cn(th, "text-right")}>Seen</th>
                  <th className={cn(th, "text-right")}>New leads</th>
                  <th className={cn(th, "text-right")} title="Sites the run found that offer listings only by email signup, added to Email sources">Email sources</th>
                  <th className={cn(th, "text-right")}>Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>
                      {formatDateUS(run.startedAt, { month: "short", day: "numeric" })}{" "}
                      {run.startedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC
                    </td>
                    <td className={cn(td, "font-medium text-foreground")}>{run.searchProfileName ?? "—"}</td>
                    <td className={cn(td, run.status === "failed" ? "text-destructive" : "text-muted-foreground")} title={run.error ?? undefined}>
                      {RUN_STATUS_LABELS[run.status]}
                    </td>
                    <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>{formatCount(run.candidatesSeen)}</td>
                    <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>{formatCount(run.leadsAdded)}</td>
                    <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>{run.emailSourcesDetected > 0 ? `+${formatCount(run.emailSourcesDetected)}` : "—"}</td>
                    <td className={cn(td, "text-right tabular-nums font-medium text-foreground")}>{formatUsd(run.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </Section>
      )}
    </div>
  );
}
