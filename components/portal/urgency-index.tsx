"use client";

import { ScoringChecklist, type ScoreInput } from "./scoring-checklist";

const SCALE = [0, 1, 2, 3, 4] as const;
const MAX_PER_STATEMENT = 4;

export type UrgencyBand = {
  /** Lowest total that falls in this band. Bands are passed in ascending order. */
  min: number;
  label: string;
  color: string;
  summary: string;
};

/**
 * Tool 02 on /portal/tools: the urgency index (Habit 3 — Put First Things
 * First). Like EosCheckup, the statements and band copy arrive as props from
 * the server-rendered page so they only ship to visitors holding a valid
 * portal token. Unlike the EOS scale, 0 is a real answer here, which
 * ScoringChecklist handles by tracking "unanswered" as null.
 */
export function UrgencyIndex({ statements, bands }: { statements: string[]; bands: UrgencyBand[] }) {
  const max = statements.length * MAX_PER_STATEMENT;

  // The band is only meaningful once every statement is answered — a partial
  // sum would always read as "low urgency".
  const getBand = ({ answered, total }: ScoreInput) =>
    answered === statements.length ? ([...bands].reverse().find((b) => total >= b.min) ?? bands[0]) : null;

  const legend = bands.map((b, i) => {
    const upper = bands[i + 1] ? `${bands[i + 1].min - 1}` : `${max}`;
    return { color: b.color, label: `${b.min}–${upper} — ${b.label}` };
  });

  return (
    <ScoringChecklist
      id="urgency"
      theme="light"
      storageKey="tagr_urgency_index"
      statements={statements}
      scale={SCALE}
      label="Tool 02"
      name="The Urgency Index"
      title="Is urgency running your day?"
      intro="Put First Things First. For each statement, choose the number that best describes you, then watch the total move. The higher the score, the more your days are being driven by what is urgent rather than what is important."
      hint="0 = Never · 2 = Sometimes · 4 = Always"
      progressVerb="answered"
      legend={legend}
      summarize={(input) => {
        const band = getBand(input);
        const status = band
          ? { text: band.label, color: band.color }
          : input.answered === 0
            ? { text: "Not started", color: "rgba(245,242,236,0.55)" }
            : { text: `${statements.length - input.answered} to go`, color: "#C7A667" };
        return {
          fraction: input.total / max,
          primary: input.total,
          suffix: `/${max}`,
          status,
          ringColor: status.color,
        };
      }}
      renderResult={(input) => {
        const band = getBand(input);
        if (!band) return null;

        const drivers = input.scores
          .map((score, index) => ({ index, score: score ?? 0, text: statements[index] }))
          .filter((d) => d.score >= 3)
          .sort((a, b) => b.score - a.score || a.index - b.index)
          .slice(0, 5);

        return (
          <div className="mt-10 border-l-2 pl-6" style={{ borderColor: band.color }}>
            <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(27,29,31,0.55)]">Your result</p>
            <h3 className="mb-3 font-serif text-[24px] font-medium">
              {input.total} / {max} — {band.label}
            </h3>
            <p className="max-w-[640px] text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.75)]">{band.summary}</p>

            {drivers.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(27,29,31,0.55)]">Where urgency is winning</p>
                <ul className="max-w-[640px] space-y-2">
                  {drivers.map((d) => (
                    <li key={d.index} className="grid grid-cols-[28px_1fr] gap-2 text-[14px] leading-[1.5] text-[rgba(27,29,31,0.8)]">
                      <span className="font-mono text-[13px] font-semibold text-[var(--brass)]">{d.score}/4</span>
                      <span>{d.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
