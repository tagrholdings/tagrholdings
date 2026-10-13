import { CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RuleCheck } from "@/modules/traction/traction.logic";

/**
 * Where the workspace is using a tool against an EOS rule (modules/traction/traction.logic.ts → eosRuleChecks).
 * A nudge, never a block: the page still works, it just says what EOS expects. Renders nothing when all is well.
 */
export function RuleChecks({ checks, className, tourId }: { checks: RuleCheck[]; className?: string; tourId?: string }) {
  if (checks.length === 0) return null;
  return (
    <ul data-tour={tourId} className={cn("flex flex-col gap-1.5 rounded-lg border border-divider bg-surface px-4 py-3", className)} aria-label="EOS checks">
      {checks.map((check) => (
        <li key={check.message} className="flex items-start gap-2 text-sm">
          {check.level === "warn" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <span>{check.message}</span>
        </li>
      ))}
    </ul>
  );
}
