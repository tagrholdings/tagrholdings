"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

const CIRC = 2 * Math.PI * 52;

/**
 * Appendix A's interactive scoring tool. The statements arrive as props from
 * the server-rendered playbook: anything defined in a client module ships in
 * a public JS chunk whether or not the visitor holds a valid portal token.
 */
export function EosCheckup({ statements }: { statements: string[] }) {
  const [scores, setScores] = useState<number[]>(() => new Array(statements.length).fill(0));
  const [savedNote, setSavedNote] = useState("");
  const [isDocked, setIsDocked] = useState(false);
  const [isEosVisible, setIsEosVisible] = useState(false);

  const eosRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const raw = window.localStorage.getItem("tagr_eos_checkup");
        if (raw) {
          const saved = JSON.parse(raw) as number[];
          if (Array.isArray(saved) && saved.length === statements.length) {
            setScores(saved);
            setSavedNote("Restored from a previous session.");
          }
        }
      } catch {
        // ignore storage errors
      }
    });
  }, [statements.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sentinelEl = sentinelRef.current;
    const eosEl = eosRef.current;

    const sentinelObserver = new IntersectionObserver(
      ([entry]) => {
        setIsDocked(entry.isIntersecting);
      },
      { threshold: 0.1, rootMargin: "0px 0px 40px 0px" }
    );

    const eosObserver = new IntersectionObserver(
      ([entry]) => {
        setIsEosVisible(entry.isIntersecting);
      },
      { threshold: 0.02 }
    );

    if (sentinelEl) sentinelObserver.observe(sentinelEl);
    if (eosEl) eosObserver.observe(eosEl);

    return () => {
      if (sentinelEl) sentinelObserver.unobserve(sentinelEl);
      if (eosEl) eosObserver.unobserve(eosEl);
      sentinelObserver.disconnect();
      eosObserver.disconnect();
    };
  }, []);

  const answered = scores.filter((s) => s > 0).length;
  const total = scores.reduce((sum, value) => sum + value, 0);
  const pct = Math.round((total / (statements.length * 5)) * 100);
  const offset = CIRC - (pct / 100) * CIRC;

  const status = useMemo(() => {
    if (answered === 0) return { text: "Not started", color: "rgba(245,242,236,0.55)" };
    if (pct < 40) return { text: "Needs focus", color: "#d98a7c" };
    if (pct < 70) return { text: "Building foundation", color: "#C7A667" };
    return { text: "Strong & scalable", color: "#9bc79b" };
  }, [answered, pct]);

  const handleChange = (index: number, value: number) => {
    setScores((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleSave = () => {
    try {
      window.localStorage.setItem("tagr_eos_checkup", JSON.stringify(scores));
      const now = new Date();
      setSavedNote(`Saved at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } catch {
      setSavedNote("Could not save.");
    }
  };

  const handleReset = () => {
    setScores(new Array(statements.length).fill(0));
    setSavedNote("");
    try {
      window.localStorage.removeItem("tagr_eos_checkup");
    } catch {
      // ignore storage errors
    }
  };

  return (
    <section id="eos" ref={eosRef} className="bg-[var(--ink)] py-[86px] text-[var(--cream)] px-8">
      <div className="max-w-[920px] mx-auto">
        <div className="flex items-baseline gap-4 mb-2.5">
          <span className="font-mono text-[#C7A667] text-sm font-semibold tracking-[0.05em]">Appendix A</span>
          <span className="text-[11.5px] tracking-[0.22em] uppercase text-[rgba(245,242,236,0.55)] font-semibold">EOS Organizational Checkup</span>
        </div>
        <h2 className="text-[clamp(26px,3.4vw,36px)] font-semibold text-[var(--cream)] mb-[18px] tracking-[-0.01em] font-serif">Score your company, live</h2>
        <p className="font-serif italic font-light text-[rgba(245,242,236,0.72)] text-[18.5px] max-w-[640px] mb-10">For each statement, rank the company from 1 (weak) to 5 (strong). The Scorecard on the right updates in real time — exactly the discipline we expect of every weekly scorecard in the portfolio.</p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-10 items-start relative">
          <div className="bg-[rgba(245,242,236,0.03)] border border-[rgba(245,242,236,0.16)]">
            {statements.map((text, index) => (
              <div className="px-6 py-5 border-b border-[rgba(245,242,236,0.16)] last:border-0 grid grid-cols-1 sm:grid-cols-[34px_1fr_auto] gap-2.5 sm:gap-[18px] items-center" key={text}>
                <div className="hidden sm:block font-mono text-[#C7A667] text-[13px] font-semibold">{String(index + 1).padStart(2, "0")}</div>
                <div className="text-[14.5px] text-[rgba(245,242,236,0.9)] leading-[1.55] font-sans">{text}</div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const inputId = `q${index}v${value}`;
                    const isChecked = scores[index] === value;
                    return (
                      <div key={inputId}>
                        <input type="radio" name={`q${index}`} id={inputId} value={value} checked={isChecked} onChange={() => handleChange(index, value)} className="absolute opacity-0 w-0 h-0 peer" />
                        <label htmlFor={inputId} className={`w-[30px] h-[30px] border border-[rgba(245,242,236,0.16)] rounded-full flex items-center justify-center font-mono text-[12px] cursor-pointer transition-all duration-150 select-none hover:border-[#C7A667] hover:text-[#C7A667] peer-checked:bg-[#C7A667] peer-checked:border-[#C7A667] peer-checked:text-[var(--ink)] peer-checked:font-bold ${isChecked ? 'bg-[#C7A667] border-[#C7A667] text-[var(--ink)] font-bold' : 'text-[rgba(245,242,236,0.55)]'}`}>{value}</label>
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
            initial={{ y: 50, opacity: 0, scale: 0.94 }}
            animate={
              isEosVisible || isDocked
                ? { y: 0, opacity: 1, scale: 1 }
                : { y: 50, opacity: 0, scale: 0.94 }
            }
            transition={{
              layout: { type: "spring", stiffness: 280, damping: 26 },
              opacity: { duration: 0.35 },
              y: { type: "spring", stiffness: 320, damping: 28 }
            }}
            className={
              isDocked 
                ? "z-40 relative bg-[rgba(245,242,236,0.03)] border border-[rgba(245,242,236,0.16)] rounded-xl block p-7 shadow-none md:sticky md:top-[106px] md:bottom-auto md:left-auto md:right-auto md:text-center md:mt-0 md:backdrop-blur-none md:shadow-none"
                : "z-40 fixed bottom-4 left-4 right-4 top-auto rounded-2xl bg-[rgba(27,29,31,0.95)] backdrop-blur-md border border-[#C7A667]/40 p-2.5 px-3.5 flex items-center justify-between gap-2 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.65)] flex-wrap md:sticky md:top-[106px] md:bottom-auto md:left-auto md:right-auto md:bg-[rgba(245,242,236,0.03)] md:border-[rgba(245,242,236,0.16)] md:p-7 md:text-center md:rounded-xl md:mt-0 md:shadow-none md:block md:backdrop-blur-none"
            }
          >
            <h4 className={`text-[11px] tracking-[0.2em] uppercase text-[rgba(245,242,236,0.55)] font-bold mb-5 font-mono ${isDocked ? 'block' : 'hidden md:block'}`}>Live Scorecard</h4>
            
            <div className={`items-center flex-1 min-w-[140px] ${isDocked ? 'block' : 'flex md:block gap-2.5'}`}>
              <div className={`relative shrink-0 md:mx-auto md:mb-[18px] ${isDocked ? 'w-[170px] h-[170px] mx-auto mb-6 md:w-[190px] md:h-[190px] md:mb-[18px]' : 'w-[46px] h-[46px] md:w-[190px] md:h-[190px]'}`}>
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <defs>
                    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#9C7A3C"/>
                      <stop offset="100%" stopColor="#C7A667"/>
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(245,242,236,0.16)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="url(#goldGrad)" strokeWidth="10" strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} strokeDasharray={CIRC.toFixed(1)} strokeDashoffset={offset} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={`font-serif font-semibold text-[var(--cream)] leading-none font-bold ${isDocked ? 'text-[36px]' : 'text-[13px] md:text-[36px]'}`}>
                    {pct}<span className={`text-[#C7A667] ${isDocked ? 'text-[18px]' : 'text-[8px] md:text-[18px]'}`}>%</span>
                  </div>
                  <div className={`text-[9.5px] max-w-[110px] text-center leading-[1.2] tracking-[0.08em] uppercase text-[#C7A667] font-semibold font-mono ${isDocked ? 'block mt-1.5 md:mt-1' : 'hidden md:block md:mt-1'}`} style={{ color: status.color }}>
                    {status.text}
                  </div>
                </div>
              </div>
              
              <div className={`justify-center ${isDocked ? 'flex flex-col text-center' : 'flex flex-col md:block'}`}>
                <div className={`text-[rgba(245,242,236,0.6)] text-[12px] md:text-[13px] leading-[1.25] md:leading-[1.6] font-sans ${isDocked ? 'mb-5' : 'md:mb-5'}`}>
                  <b className="text-[var(--cream)]">{answered}</b> of {statements.length} <span className={`${isDocked ? 'inline' : 'hidden md:inline'}`}>statements scored.</span>
                </div>
                <div className={`text-[10px] tracking-[0.05em] font-semibold uppercase mt-[1px] font-mono ${isDocked ? 'hidden' : 'md:hidden'}`} style={{ color: status.color }}>
                  {status.text}
                </div>
              </div>
            </div>
            
            <div className={`shrink-0 ${isDocked ? 'flex gap-[6px] md:gap-2.5 mt-2 md:mt-0' : 'flex gap-[6px] md:gap-2.5'}`}>
              <button type="button" onClick={handleSave} className="flex-1 bg-transparent border border-[rgba(245,242,236,0.16)] text-[var(--cream)] font-mono text-[10.5px] md:text-[12px] tracking-[0.05em] uppercase px-2.5 py-[7px] md:px-2 md:py-2.5 rounded-md md:rounded cursor-pointer transition-all duration-150 font-semibold hover:border-[#C7A667] hover:text-[#C7A667]">Save</button>
              <button type="button" onClick={handleReset} className="flex-1 bg-transparent border border-[rgba(245,242,236,0.16)] text-[var(--cream)] font-mono text-[10.5px] md:text-[12px] tracking-[0.05em] uppercase px-2.5 py-[7px] md:px-2 md:py-2.5 rounded-md md:rounded cursor-pointer transition-all duration-150 font-semibold hover:border-[#C7A667] hover:text-[#C7A667]">Reset</button>
            </div>
            
            {savedNote && <div className={`w-full text-center text-[#C7A667] font-mono ${isDocked ? 'mt-3.5 text-[11px] md:mt-3.5' : 'mt-0.5 md:mt-3.5 text-[10px] md:text-[11px]'}`}>{savedNote}</div>}
          </motion.div>
        </div>
        <div className="flex gap-4 flex-wrap mt-[22px] text-[11.5px] text-[rgba(245,242,236,0.55)] font-sans">
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#d98a7c" }}></i> 0–39% — Needs focus</span>
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#C7A667" }}></i> 40–69% — Building the foundation</span>
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#9bc79b" }}></i> 70–100% — Strong &amp; scalable</span>
        </div>
      </div>
    </section>
  );
}
