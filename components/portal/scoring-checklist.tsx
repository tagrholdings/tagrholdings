"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

const CIRC = 2 * Math.PI * 52;

/** `null` = not answered yet. Scales may include 0 (Urgency Index), so 0 can't mean "empty". */
export type Score = number | null;

export interface ScoreInput {
  scores: Score[];
  answered: number;
  total: number;
}

export interface ScoreSummary {
  /** 0–1 share of the ring to fill. */
  fraction: number;
  /** Big number in the ring's centre. */
  primary: ReactNode;
  /** Small unit next to it, e.g. "%" or "/64". */
  suffix?: ReactNode;
  status: { text: string; color: string };
  /** Solid ring colour; omit for the brass gradient. */
  ringColor?: string;
}

export interface LegendItem {
  color: string;
  label: string;
}

const THEMES = {
  dark: {
    section: "bg-[var(--ink)] text-[var(--cream)]",
    label: "text-[#C7A667]",
    eyebrow: "text-[rgba(245,242,236,0.55)]",
    title: "text-[var(--cream)]",
    intro: "text-[rgba(245,242,236,0.72)]",
    hint: "text-[rgba(245,242,236,0.55)]",
    list: "border-[rgba(245,242,236,0.16)] bg-[rgba(245,242,236,0.03)]",
    row: "border-[rgba(245,242,236,0.16)]",
    number: "text-[#C7A667]",
    text: "text-[rgba(245,242,236,0.9)]",
    dot: "border-[rgba(245,242,236,0.16)] text-[rgba(245,242,236,0.55)] hover:border-[#C7A667] hover:text-[#C7A667] peer-checked:border-[#C7A667] peer-checked:bg-[#C7A667] peer-checked:text-[var(--ink)]",
    // The scorecard is dark on both themes; on a light section it needs a solid fill.
    card: "bg-[rgba(245,242,236,0.03)]",
    mdCard: "md:bg-[rgba(245,242,236,0.03)]",
  },
  light: {
    section: "bg-[var(--paper-2)] text-[var(--ink)]",
    label: "text-[var(--brass)]",
    eyebrow: "text-[rgba(27,29,31,0.55)]",
    title: "text-[var(--ink)]",
    intro: "text-[rgba(27,29,31,0.72)]",
    hint: "text-[rgba(27,29,31,0.6)]",
    list: "border-[rgba(27,29,31,0.14)] bg-[var(--paper)]",
    row: "border-[rgba(27,29,31,0.14)]",
    number: "text-[var(--brass)]",
    text: "text-[rgba(27,29,31,0.9)]",
    dot: "border-[rgba(27,29,31,0.25)] text-[rgba(27,29,31,0.6)] hover:border-[var(--brass)] hover:text-[var(--brass)] peer-checked:border-[var(--brass)] peer-checked:bg-[var(--brass)] peer-checked:text-[var(--ink)]",
    card: "bg-[var(--ink)]",
    mdCard: "md:bg-[var(--ink)]",
  },
} as const;

/**
 * The shared shell for the portal's self-scoring checklists (EOS Checkup,
 * Urgency Index): the statement list, the localStorage save/restore, and the
 * live scorecard that docks in beside the list on desktop and floats as a
 * compact bar on mobile while the list is on screen.
 *
 * What a tool decides for itself is passed in: the scale, how a set of answers
 * turns into a score (`summarize`), and the optional result panel below the
 * list (`renderResult`). Statements arrive as props from a server-rendered
 * parent so they only ship to visitors holding a valid portal token.
 */
export function ScoringChecklist({
  id,
  theme,
  storageKey,
  statements,
  scale,
  label,
  name,
  title,
  intro,
  hint,
  progressVerb,
  summarize,
  renderResult,
  legend,
}: {
  /** Anchor id, also namespaces the radio inputs so two tools can share a page. */
  id: string;
  theme: keyof typeof THEMES;
  storageKey: string;
  statements: string[];
  scale: readonly number[];
  label: string;
  name: string;
  title: string;
  intro: ReactNode;
  hint?: ReactNode;
  /** "scored" / "answered" — completes "x of N statements …" in the scorecard. */
  progressVerb: string;
  summarize: (input: ScoreInput) => ScoreSummary;
  renderResult?: (input: ScoreInput) => ReactNode;
  legend: LegendItem[];
}) {
  const t = THEMES[theme];
  const gradId = `${useId().replace(/:/g, "")}-ring`;

  const [scores, setScores] = useState<Score[]>(() => new Array(statements.length).fill(null));
  const [savedNote, setSavedNote] = useState("");
  const [isDocked, setIsDocked] = useState(false);
  const [isSectionVisible, setIsSectionVisible] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        const saved: unknown = JSON.parse(raw);
        if (
          Array.isArray(saved) &&
          saved.length === statements.length &&
          saved.every((v) => v === null || typeof v === "number")
        ) {
          // Anything outside the scale (the EOS checkup used to store 0 for
          // "unanswered") is read back as unanswered.
          const restored = saved.map((v) => (v !== null && scale.includes(v) ? v : null));
          if (restored.some((v) => v !== null)) {
            setScores(restored);
            setSavedNote("Restored from a previous session.");
          }
        }
      } catch {
        // ignore storage errors
      }
    });
  }, [storageKey, statements.length, scale]);

  useEffect(() => {
    const sentinelEl = sentinelRef.current;
    const sectionEl = sectionRef.current;

    const sentinelObserver = new IntersectionObserver(
      ([entry]) => setIsDocked(entry.isIntersecting),
      { threshold: 0.1, rootMargin: "0px 0px 40px 0px" }
    );
    const sectionObserver = new IntersectionObserver(
      ([entry]) => setIsSectionVisible(entry.isIntersecting),
      { threshold: 0.02 }
    );

    if (sentinelEl) sentinelObserver.observe(sentinelEl);
    if (sectionEl) sectionObserver.observe(sectionEl);

    return () => {
      sentinelObserver.disconnect();
      sectionObserver.disconnect();
    };
  }, []);

  const answered = scores.filter((s) => s !== null).length;
  const total = scores.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const input: ScoreInput = { scores, answered, total };
  const summary = summarize(input);
  const offset = CIRC - summary.fraction * CIRC;

  const handleChange = (index: number, value: number) => {
    setScores((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleSave = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(scores));
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
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore storage errors
    }
  };

  return (
    <section id={id} ref={sectionRef} className={`${t.section} px-6 py-[86px] lg:px-8`}>
      <div className="mx-auto max-w-[920px]">
        <div className="mb-2.5 flex items-baseline gap-4">
          <span className={`font-mono text-sm font-semibold tracking-[0.05em] ${t.label}`}>{label}</span>
          <span className={`text-[11.5px] font-semibold uppercase tracking-[0.22em] ${t.eyebrow}`}>{name}</span>
        </div>
        <h2 className={`mb-[18px] font-serif text-[clamp(26px,3.4vw,36px)] font-semibold tracking-[-0.01em] ${t.title}`}>{title}</h2>
        <p className={`max-w-[640px] font-serif text-[18.5px] font-light italic ${t.intro} ${hint ? "mb-3" : "mb-10"}`}>{intro}</p>
        {hint && <p className={`mb-10 font-mono text-[11.5px] uppercase tracking-[0.06em] ${t.hint}`}>{hint}</p>}

        <div className="relative grid grid-cols-1 items-start gap-10 md:grid-cols-[1fr_300px]">
          <div className={`border ${t.list}`}>
            {statements.map((text, index) => (
              <div
                key={index}
                className={`grid grid-cols-1 items-center gap-2.5 border-b px-6 py-5 last:border-0 sm:grid-cols-[34px_1fr_auto] sm:gap-[18px] ${t.row}`}
              >
                <div className={`hidden font-mono text-[13px] font-semibold sm:block ${t.number}`}>{String(index + 1).padStart(2, "0")}</div>
                <div id={`${id}-q${index}`} className={`font-sans text-[14.5px] leading-[1.55] ${t.text}`}>
                  {text}
                </div>
                <div role="radiogroup" aria-labelledby={`${id}-q${index}`} className="flex gap-1.5">
                  {scale.map((value) => {
                    const inputId = `${id}-q${index}v${value}`;
                    return (
                      <div key={value}>
                        <input
                          type="radio"
                          name={`${id}-q${index}`}
                          id={inputId}
                          value={value}
                          checked={scores[index] === value}
                          onChange={() => handleChange(index, value)}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor={inputId}
                          className={`flex h-[30px] w-[30px] cursor-pointer select-none items-center justify-center rounded-full border font-mono text-[12px] transition-all duration-150 peer-checked:font-bold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#C7A667] ${t.dot}`}
                        >
                          {value}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={sentinelRef} style={{ height: "1px", width: "100%" }} />
          </div>

          <motion.div
            layout
            aria-live="polite"
            initial={{ y: 50, opacity: 0, scale: 0.94 }}
            animate={
              isSectionVisible || isDocked
                ? { y: 0, opacity: 1, scale: 1 }
                : { y: 50, opacity: 0, scale: 0.94 }
            }
            transition={{
              layout: { type: "spring", stiffness: 280, damping: 26 },
              opacity: { duration: 0.35 },
              y: { type: "spring", stiffness: 320, damping: 28 },
            }}
            className={
              isDocked
                ? `z-40 relative block rounded-xl border border-[rgba(245,242,236,0.16)] p-7 shadow-none md:sticky md:top-[106px] md:bottom-auto md:left-auto md:right-auto md:mt-0 md:text-center md:shadow-none md:backdrop-blur-none ${t.card}`
                : `z-40 fixed bottom-4 left-4 right-4 top-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#C7A667]/40 bg-[rgba(27,29,31,0.95)] p-2.5 px-3.5 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.65)] backdrop-blur-md md:sticky md:top-[106px] md:bottom-auto md:left-auto md:right-auto md:mt-0 md:block md:rounded-xl md:border-[rgba(245,242,236,0.16)] md:p-7 md:text-center md:shadow-none md:backdrop-blur-none ${t.mdCard}`
            }
          >
            <h4 className={`mb-5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[rgba(245,242,236,0.55)] ${isDocked ? "block" : "hidden md:block"}`}>Live Scorecard</h4>

            <div className={`min-w-[140px] flex-1 items-center ${isDocked ? "block" : "flex gap-2.5 md:block"}`}>
              <div className={`relative shrink-0 md:mx-auto md:mb-[18px] ${isDocked ? "mx-auto mb-6 h-[170px] w-[170px] md:mb-[18px] md:h-[190px] md:w-[190px]" : "h-[46px] w-[46px] md:h-[190px] md:w-[190px]"}`}>
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#9C7A3C" />
                      <stop offset="100%" stopColor="#C7A667" />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(245,242,236,0.16)" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={summary.ringColor ?? `url(#${gradId})`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={CIRC.toFixed(1)}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={`font-serif font-bold leading-none text-[var(--cream)] ${isDocked ? "text-[36px]" : "text-[13px] md:text-[36px]"}`}>
                    {summary.primary}
                    {summary.suffix && <span className={`text-[#C7A667] ${isDocked ? "text-[18px]" : "text-[8px] md:text-[18px]"}`}>{summary.suffix}</span>}
                  </div>
                  <div
                    className={`max-w-[110px] text-center font-mono text-[9.5px] font-semibold uppercase leading-[1.2] tracking-[0.08em] ${isDocked ? "mt-1.5 block md:mt-1" : "hidden md:mt-1 md:block"}`}
                    style={{ color: summary.status.color }}
                  >
                    {summary.status.text}
                  </div>
                </div>
              </div>

              <div className={`justify-center ${isDocked ? "flex flex-col text-center" : "flex flex-col md:block"}`}>
                <div className={`font-sans text-[12px] leading-[1.25] text-[rgba(245,242,236,0.6)] md:text-[13px] md:leading-[1.6] ${isDocked ? "mb-5" : "md:mb-5"}`}>
                  <b className="text-[var(--cream)]">{answered}</b> of {statements.length} <span className={isDocked ? "inline" : "hidden md:inline"}>statements {progressVerb}.</span>
                </div>
                <div className={`mt-[1px] font-mono text-[10px] font-semibold uppercase tracking-[0.05em] ${isDocked ? "hidden" : "md:hidden"}`} style={{ color: summary.status.color }}>
                  {summary.status.text}
                </div>
              </div>
            </div>

            <div className={`flex shrink-0 gap-[6px] md:gap-2.5 ${isDocked ? "mt-2 md:mt-0" : ""}`}>
              <button type="button" onClick={handleSave} className="flex-1 cursor-pointer rounded-md border border-[rgba(245,242,236,0.16)] bg-transparent px-2.5 py-[7px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--cream)] transition-all duration-150 hover:border-[#C7A667] hover:text-[#C7A667] md:rounded md:px-2 md:py-2.5 md:text-[12px]">Save</button>
              <button type="button" onClick={handleReset} className="flex-1 cursor-pointer rounded-md border border-[rgba(245,242,236,0.16)] bg-transparent px-2.5 py-[7px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--cream)] transition-all duration-150 hover:border-[#C7A667] hover:text-[#C7A667] md:rounded md:px-2 md:py-2.5 md:text-[12px]">Reset</button>
            </div>

            {savedNote && <div className={`w-full text-center font-mono text-[#C7A667] ${isDocked ? "mt-3.5 text-[11px]" : "mt-0.5 text-[10px] md:mt-3.5 md:text-[11px]"}`}>{savedNote}</div>}
          </motion.div>
        </div>

        {renderResult?.(input)}

        <div className={`mt-[22px] flex flex-wrap gap-4 font-sans text-[11.5px] ${t.hint}`}>
          {legend.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
