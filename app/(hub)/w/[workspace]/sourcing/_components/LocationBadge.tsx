import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; className: string; title: string }> = {
  local: { label: "In area", className: "border-accent bg-accent/15 text-foreground", title: "The listing's city is inside the profile's radius." },
  region: { label: "Region", className: "border-divider bg-surface-alt text-foreground", title: "Same state, but the listing only names a region or the state — the exact city isn't stated." },
  state: { label: "Same state", className: "border-divider bg-surface-alt text-foreground", title: "Same state, but the city is outside the profile's radius." },
  unknown: { label: "Location?", className: "border-divider bg-transparent text-muted-foreground", title: "The listing doesn't state where the business is — check it." },
  outside: { label: "Elsewhere", className: "border-destructive/40 bg-destructive/10 text-destructive", title: "Another state or country (kept because the profile accepts listings from anywhere)." },
};

/** Where a broker listing sits relative to the profile's city + radius (`locationMatch`, set by the job). Annotation only. */
export function LocationBadge({ match, className }: { match: unknown; className?: string }) {
  const style = typeof match === "string" ? STYLES[match] : undefined;
  if (!style) return null;
  return (
    <span title={style.title} className={cn("inline-flex shrink-0 items-center rounded-pill border px-2 py-0.5 text-xs font-medium", style.className, className)}>
      {style.label}
    </span>
  );
}
