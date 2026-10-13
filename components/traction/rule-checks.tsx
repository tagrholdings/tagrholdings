import { ChevronDown, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RuleCheck } from "@/modules/traction/traction.logic";

/**
 * Where the workspace is using a tool against an EOS rule (modules/traction/traction.logic.ts → eosRuleChecks).
 * A nudge, never a block: the page still works, it just says what EOS expects. Renders nothing when all is well.
 * On a phone it folds into one line ("3 EOS checks") that opens on tap, so the page's own data comes first.
 */
export function RuleChecks({ checks, className, tourId }: { checks: RuleCheck[]; className?: string; tourId?: string }) {
  if (checks.length === 0) return null;
  const warns = checks.filter((c) => c.level === "warn").length;
  const list = (
    <ul className="flex flex-col gap-1.5" aria-label="EOS checks">
      {checks.map((check) => (
        <li key={check.message} className="flex items-start gap-2 text-sm">
          {check.level === "warn" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <span>{check.message}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div data-tour={tourId} className={cn("rounded-lg border border-divider bg-surface px-4 py-3", className)}>
      <details className="group md:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <CircleAlert className={cn("size-4 shrink-0", warns ? "text-destructive" : "text-muted-foreground")} aria-hidden />
          <span className="flex-1">
            {checks.length} EOS check{checks.length === 1 ? "" : "s"}
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2">{list}</div>
      </details>
      <div className="hidden md:block">{list}</div>
    </div>
  );
}
