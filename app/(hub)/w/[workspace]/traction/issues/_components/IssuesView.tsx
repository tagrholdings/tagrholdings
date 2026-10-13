"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { IssueList } from "@/components/traction/issue-list";
import { IssueVault } from "@/components/traction/issue-vaults";
import { RuleChecks } from "@/components/traction/rule-checks";
import type { RuleCheck } from "@/modules/traction/traction.logic";
import type { IssueHorizon, IssueRow, TractionMember } from "@/modules/traction/traction.types";

export function IssuesView({ issues, members, checks, initialHorizon }: { issues: IssueRow[]; members: TractionMember[]; checks: RuleCheck[]; initialHorizon: IssueHorizon }) {
  const [horizon, setHorizon] = useState<IssueHorizon>(initialHorizon);
  const openCount = (h: IssueHorizon) => issues.filter((i) => i.horizon === h && i.status === "open").length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<IssueHorizon>
          tourId="issues-horizon"
          value={horizon}
          onChange={setHorizon}
          options={[
            { value: "short_term", label: `This week (L10) · ${openCount("short_term")}` },
            { value: "long_term", label: `Long term (V/TO) · ${openCount("long_term")}` },
          ]}
        />
        <div className="flex-1" />
        <IssueVault
          members={members}
          defaultHorizon={horizon}
          trigger={
            <Button data-tour="issues-add">
              <Plus />
              New issue
            </Button>
          }
        />
      </div>

      <RuleChecks checks={checks} />

      <div data-tour="issues-list" className="overflow-hidden rounded-lg border border-divider bg-surface">
        <IssueList
          key={horizon}
          issues={issues}
          members={members}
          horizon={horizon}
          emptyText={horizon === "short_term" ? "No open issues for the L10. Add one, or drop a red Scorecard cell or an off-track Rock here." : "No long-term issues. These are worked at the quarterly, not the weekly L10."}
        />
      </div>
    </>
  );
}
