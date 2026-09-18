"use client";

import { useEffect, useState } from "react";

const CIRC = 2 * Math.PI * 52;
const STORAGE_KEY = "tagr_urgency_index";
const SCALE = [0, 1, 2, 3, 4] as const;
const MAX_PER_STATEMENT = 4;

export type UrgencyBand = {
  /** Lowest total that falls in this band. Bands are passed in ascending order. */
  min: number;
  label: string;
  color: string;
  summary: string;
};

type Score = number | null;

function isValidSaved(value: unknown, length: number): value is Score[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= MAX_PER_STATEMENT))
  );
}

/**
 * Appendix B's interactive scoring tool (Habit 3 — Put First Things First).
 * Like EosCheckup, the statements and band copy arrive as props from the
 * server-rendered playbook so they only ship to visitors holding a valid
 * portal token. Unlike the EOS scale, 0 is a real answer here, so an
 * unanswered statement is `null` rather than 0.
 */
export function UrgencyIndex({ statements, bands }: { statements: string[]; bands: UrgencyBand[] }) {
  const [scores, setScores] = useState<Score[]>(() => new Array(statements.length).fill(null));
  const [savedNote, setSavedNote] = useState("");

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved: unknown = JSON.parse(raw);
        if (isValidSaved(saved, statements.length)) {
          setScores(saved);
          setSavedNote("Restored from a previous session.");
        }
      } catch {
        // ignore storage errors
      }
    });
  }, [statements.length]);

  const max = statements.length * MAX_PER_STATEMENT;
  const answered = scores.filter((s) => s !== null).length;
  const total = scores.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const complete = answered === statements.length;
  const offset = CIRC - (total / max) * CIRC;

  // The band is only meaningful once every statement is answered — a partial
  // sum would always read as "low urgency".
  const band = complete ? ([...bands].reverse().find((b) => total >= b.min) ?? bands[0]) : null;
  const status = band
    ? { text: band.label, color: band.color }
    : answered === 0
      ? { text: "Not started", color: "rgba(245,242,236,0.55)" }
      : { text: `${statements.length - answered} to go`, color: "#C7A667" };

  const drivers = scores
    .map((score, index) => ({ index, score: score ?? 0, text: statements[index] }))
    .filter((d) => d.score >= 3)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5);

  const handleChange = (index: number, value: number) => {
    setScores((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleSave = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
      const now = new Date();
      setSavedNote(`Saved at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    } catch {
      setSavedNote("Could not save.");
    }
  };

  const handleReset = () => {
    setScores(new Array(statements.length).fill(null));
    setSavedNote("");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  };

  return (
    <section id="urgency" className="bg-[var(--paper-2)] px-6 py-[86px] text-[var(--ink)] lg:px-8">
      <div className="mx-auto max-w-[920px]">
        <div className="mb-2.5 flex items-baseline gap-4">
          <span className="font-mono text-sm font-semibold tracking-[0.05em] text-[var(--brass)]">Appendix B</span>
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.22em] text-[rgba(27,29,31,0.55)]">The Urgency Index</span>
        </div>
        <h2 className="mb-[18px] font-serif text-[clamp(26px,3.4vw,36px)] font-semibold tracking-[-0.01em]">Is urgency running your day?</h2>
        <p className="mb-3 max-w-[640px] font-serif text-[18.5px] font-light italic text-[rgba(27,29,31,0.72)]">
          Put First Things First. For each statement, choose the number that best describes you, then watch the total move. The higher the score, the more your days are being driven by what is urgent rather than what is important.
        </p>
        <p className="mb-10 font-mono text-[11.5px] uppercase tracking-[0.06em] text-[rgba(27,29,31,0.55)]">
          0 = Never &nbsp;·&nbsp; 2 = Sometimes &nbsp;·&nbsp; 4 = Always
        </p>

        <div className="relative grid grid-cols-1 items-start gap-10 md:grid-cols-[1fr_300px]">
          <div className="border border-[rgba(27,29,31,0.14)] bg-[var(--paper)]">
            {statements.map((text, index) => (
              <div
                key={index}
                className="grid grid-cols-1 items-center gap-2.5 border-b border-[rgba(27,29,31,0.14)] px-6 py-5 last:border-0 sm:grid-cols-[34px_1fr_auto] sm:gap-[18px]"
              >
                <div className="hidden font-mono text-[13px] font-semibold text-[var(--brass)] sm:block">{String(index + 1).padStart(2, "0")}</div>
                <div id={`urgency-q${index}`} className="font-sans text-[14.5px] leading-[1.55] text-[rgba(27,29,31,0.9)]">
                  {text}
                </div>
                <div role="radiogroup" aria-labelledby={`urgency-q${index}`} className="flex gap-1.5">
                  {SCALE.map((value) => {
                    const inputId = `urgency-q${index}v${value}`;
                    return (
                      <div key={value}>
                        <input
                          type="radio"
                          name={`urgency-q${index}`}
                          id={inputId}
                          value={value}
                          checked={scores[index] === value}
                          onChange={() => handleChange(index, value)}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor={inputId}
                          className="flex h-[30px] w-[30px] cursor-pointer select-none items-center justify-center rounded-full border border-[rgba(27,29,31,0.25)] font-mono text-[12px] text-[rgba(27,29,31,0.6)] transition-all duration-150 hover:border-[var(--brass)] hover:text-[var(--brass)] peer-checked:border-[var(--brass)] peer-checked:bg-[var(--brass)] peer-checked:font-bold peer-checked:text-[var(--ink)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--brass)]"
                        >
                          {value}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Pinned to the bottom of the viewport on mobile, to the top on desktop. */}
          <div
            aria-live="polite"
            className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#C7A667]/40 bg-[rgba(27,29,31,0.95)] px-3.5 py-2.5 text-[var(--cream)] backdrop-blur-md md:top-[106px] md:bottom-auto md:block md:rounded-xl md:border-[rgba(245,242,236,0.16)] md:bg-[var(--ink)] md:p-7 md:text-center md:backdrop-blur-none"
          >
            <h4 className="mb-5 hidden font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[rgba(245,242,236,0.55)] md:block">Your Urgency Score</h4>

            <div className="flex min-w-[140px] flex-1 items-center gap-2.5 md:block">
              <div className="relative h-[46px] w-[46px] shrink-0 md:mx-auto md:mb-[18px] md:h-[190px] md:w-[190px]">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(245,242,236,0.16)" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={status.color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={CIRC.toFixed(1)}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="font-serif text-[15px] font-bold leading-none text-[var(--cream)] md:text-[40px]">{total}</div>
                  <div className="hidden font-mono text-[11px] tracking-[0.08em] text-[rgba(245,242,236,0.55)] md:mt-1 md:block">of {max}</div>
                </div>
              </div>

              <div className="flex flex-col md:block">
                <div className="font-mono text-[10px] font-semibold uppercase leading-tight tracking-[0.05em] md:mb-2 md:text-[11px] md:tracking-[0.08em]" style={{ color: status.color }}>
                  {status.text}
                </div>
                <div className="font-sans text-[12px] leading-[1.25] text-[rgba(245,242,236,0.6)] md:mb-5 md:text-[13px] md:leading-[1.6]">
                  <b className="text-[var(--cream)]">{answered}</b> of {statements.length} <span className="hidden md:inline">statements answered.</span>
                  <span className="md:hidden"> answered</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-1.5 md:gap-2.5">
              <button type="button" onClick={handleSave} className="flex-1 cursor-pointer rounded-md border border-[rgba(245,242,236,0.16)] bg-transparent px-2.5 py-[7px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--cream)] transition-all duration-150 hover:border-[#C7A667] hover:text-[#C7A667] md:rounded md:px-2 md:py-2.5 md:text-[12px]">Save</button>
              <button type="button" onClick={handleReset} className="flex-1 cursor-pointer rounded-md border border-[rgba(245,242,236,0.16)] bg-transparent px-2.5 py-[7px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--cream)] transition-all duration-150 hover:border-[#C7A667] hover:text-[#C7A667] md:rounded md:px-2 md:py-2.5 md:text-[12px]">Reset</button>
            </div>

            {savedNote && <div className="w-full text-center font-mono text-[10px] text-[#C7A667] md:mt-3.5 md:text-[11px]">{savedNote}</div>}
          </div>
        </div>

        {band && (
          <div className="mt-10 border-l-2 pl-6" style={{ borderColor: band.color }}>
            <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(27,29,31,0.55)]">Your result</p>
            <h3 className="mb-3 font-serif text-[24px] font-medium">
              {total} / {max} — {band.label}
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
        )}

        <div className="mt-[22px] flex flex-wrap gap-4 font-sans text-[11.5px] text-[rgba(27,29,31,0.6)]">
          {bands.map((b, i) => {
            const upper = bands[i + 1] ? `${bands[i + 1].min - 1}` : `${max}`;
            return (
              <span key={b.label} className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: b.color }}></i>
                {b.min}–{upper} — {b.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
