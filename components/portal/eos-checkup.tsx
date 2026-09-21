"use client";

import { ScoringChecklist, type LegendItem } from "./scoring-checklist";

const SCALE = [1, 2, 3, 4, 5] as const;
const MAX_PER_STATEMENT = 5;

const LEGEND: LegendItem[] = [
  { color: "#d98a7c", label: "0–39% — Needs focus" },
  { color: "#C7A667", label: "40–69% — Building the foundation" },
  { color: "#9bc79b", label: "70–100% — Strong & scalable" },
];

/**
 * Tool 01 on /portal/tools: the EOS organizational checkup. The statements
 * arrive as props from the server-rendered page: anything defined in a client
 * module ships in a public JS chunk whether or not the visitor holds a valid
 * portal token. The checklist UI itself is ScoringChecklist.
 */
export function EosCheckup({ statements }: { statements: string[] }) {
  return (
    <ScoringChecklist
      id="eos"
      theme="dark"
      storageKey="tagr_eos_checkup"
      statements={statements}
      scale={SCALE}
      label="Tool 01"
      name="EOS Organizational Checkup"
      title="Score your company, live"
      intro="For each statement, rank the company from 1 (weak) to 5 (strong). The Scorecard on the right updates in real time — exactly the discipline we expect of every weekly scorecard in the portfolio."
      progressVerb="scored"
      legend={LEGEND}
      summarize={({ answered, total }) => {
        const fraction = total / (statements.length * MAX_PER_STATEMENT);
        const pct = Math.round(fraction * 100);
        const status =
          answered === 0
            ? { text: "Not started", color: "rgba(245,242,236,0.55)" }
            : pct < 40
              ? { text: "Needs focus", color: "#d98a7c" }
              : pct < 70
                ? { text: "Building foundation", color: "#C7A667" }
                : { text: "Strong & scalable", color: "#9bc79b" };
        return { fraction, primary: pct, suffix: "%", status };
      }}
    />
  );
}
