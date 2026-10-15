import { cn } from "@/lib/utils";
import type { FitStatus } from "@/modules/search-profiles/fit";

const STYLES: Record<FitStatus, { label: string; className: string; title: string }> = {
  match: { label: "Match", className: "border-accent bg-accent/15 text-foreground", title: "Every requirement that could be checked passed." },
  partial: { label: "Partial", className: "border-divider bg-surface-alt text-foreground", title: "Some requirements passed; the rest couldn't be checked (the source didn't state the figure)." },
  miss: { label: "Miss", className: "border-destructive/40 bg-destructive/10 text-destructive", title: "A stated figure is outside the profile's requirements." },
  unknown: { label: "Unknown", className: "border-divider bg-transparent text-muted-foreground", title: "Nothing could be checked — the source didn't state revenue, profit or size." },
};

/** How a lead lines up with its search profile's criteria. Annotation only — a "Miss" is never hidden or deleted. */
export function FitBadge({ status, className }: { status: FitStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <span title={style.title} className={cn("inline-flex shrink-0 items-center rounded-pill border px-2 py-0.5 text-xs font-medium", style.className, className)}>
      {style.label}
    </span>
  );
}
