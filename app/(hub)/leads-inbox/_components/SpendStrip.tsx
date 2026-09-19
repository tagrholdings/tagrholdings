import { formatCount, formatUsd } from "@/utils/money";
import type { SpendTotals } from "@/modules/lead-engine/lead-engine.types";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="label-kicker">{label}</p>
      <p className="mt-1 truncate font-serif text-xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Headline spend numbers. Amounts are the engine's estimates at list price
 * (see lead-engine.schema.ts); the `hint` under the total keeps that visible.
 * Shown at the top of the "Engine spend" tab only — the Inbox stays a clean queue.
 */
export function SpendStrip({ totals }: { totals: SpendTotals }) {
  return (
    <section aria-label="Engine spend" className="rounded-lg border border-divider bg-surface">
      <div className="grid grid-cols-2 divide-x divide-divider md:grid-cols-4">
        <Stat label="Total spent" value={formatUsd(totals.totalUsd)} hint="Estimated, list price" />
        <Stat label="This month" value={formatUsd(totals.monthUsd)} />
        <Stat label="Last 7 days" value={formatUsd(totals.last7DaysUsd)} />
        <Stat
          label="Cost per lead"
          value={totals.costPerLeadUsd === null ? "—" : formatUsd(totals.costPerLeadUsd)}
          hint={`${formatCount(totals.leadsAdded)} leads found`}
        />
      </div>
    </section>
  );
}
