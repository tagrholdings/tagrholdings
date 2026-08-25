"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AnimatedSection } from "@/components/landing/animated-section";
import { HeroHeader } from "@/components/shared/hero-header";
import { NavBar } from "@/components/shared/nav-bar";
import { ScrollToTop } from "@/components/shared/scroll-to-top";

const statements = [
  "We have a clear vision in writing that has been properly communicated and is shared by everyone.",
  "Our core values are clear, and we are hiring, reviewing, rewarding, and firing around them.",
  "Our core business is clear, and our systems and processes reflect that.",
  "Our 10-Year Target is clear and has been communicated to everyone.",
  "Our target market is clear, and our sales and marketing efforts are focused on it.",
  "Our differentiators are clear, and all of our sales and marketing efforts communicate them.",
  "We have a proven process for doing business with our customers. It has been named and visually illustrated, and everyone is adhering to it.",
  "All of the people in our organization are the right people.",
  "Our accountability chart is clear, complete, and constantly updated.",
  "Everyone is in the right seat.",
  "Our leadership team is open and honest, and demonstrates a high level of trust.",
  "Everyone has Rocks and is focused on them (3 to 7 priorities per quarter).",
  "Everyone is engaged in regular weekly meetings.",
  "All meetings are on the same day and at the same time each week, have the same printed agenda, start on time, and end on time.",
  "All teams clearly identify, discuss, and solve key issues for the greater good and long term.",
  "Our systems and processes are documented, simplified, and followed by all.",
  "We have a system for receiving regular customer and employee feedback, and we know their level of satisfaction.",
  "A Scorecard for weekly metrics and measurables is in place.",
  "Everyone in the organization has a number.",
  "We have a budget and are monitoring it regularly (e.g., monthly or quarterly).",
];

const CIRC = 2 * Math.PI * 52;

const navLinks = [
  { href: "#s01", label: "Methodologies" },
  { href: "#s02", label: "SOPs & Tools" },
  { href: "#s03", label: "Governance" },
  { href: "#s04", label: "Cadence" },
  { href: "#s05", label: "Growth" },
  { href: "#eos", label: "EOS Checkup" },
];

export function OperatingPlaybook() {
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
  }, []);

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
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] selection:bg-[var(--brass)] selection:text-[var(--ink)]">
      <NavBar links={navLinks} />

      <HeroHeader
        kicker="Portfolio Executive Framework · 2026"
        title={
          <>
            Operating <em className="not-italic text-[#C7A667]">Playbook</em>
          </>
        }
        description="This living document outlines our core methodologies, standard operating procedures, and governance cadence. It serves as the single source of truth for founders, operators, and partners within the TAGR ecosystem to align on how we build, scale, and operate our companies."
        actions={
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => document.getElementById("s01")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full bg-[var(--brass)] px-6 py-3 font-mono text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink)] transition-colors hover:bg-white"
            >
              Explore Framework
            </button>
            <button 
              onClick={() => document.getElementById("eos-checkup")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full border border-[rgba(245,242,236,0.2)] px-6 py-3 font-mono text-[11.5px] uppercase tracking-[0.06em] text-[var(--cream)] transition-colors hover:border-[var(--brass)] hover:bg-[rgba(199,166,103,0.05)]"
            >
              EOS Checkup
            </button>
          </div>
        }
      >
        <div className="mt-16 grid grid-cols-2 gap-8 border-t border-[rgba(245,242,236,0.1)] pt-10 md:grid-cols-4">
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#C7A667]">Audience</div>
            <div className="text-[14px] text-[rgba(245,242,236,0.8)]">Portfolio Executives</div>
          </div>
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#C7A667]">Framework</div>
            <div className="text-[14px] text-[rgba(245,242,236,0.8)]">EOS® / Traction</div>
          </div>
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#C7A667]">Status</div>
            <div className="flex items-center gap-2 text-[14px] text-[rgba(245,242,236,0.8)]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span> Active
            </div>
          </div>
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#C7A667]">Document info</div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[rgba(245,242,236,0.55)]">
              <span>Confidential</span>
              <span className="h-1 w-1 rounded-full bg-[#C7A667]"></span>
              <span>v1.1</span>
            </div>
          </div>
        </div>
      </HeroHeader>

      <section id="s01" className="border-b border-[rgba(27,29,31,0.14)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
                01 — Foundational Methodologies
              </p>
              <h2 className="mt-3 max-w-xl font-serif text-[clamp(1.75rem,3vw,2.6rem)] font-medium">
                The frameworks we build on
              </h2>
            </div>
            <p className="max-w-[400px] text-[15px] leading-[1.6] text-[rgba(27,29,31,0.65)]">
              We build and scale our companies on proven frameworks that create alignment, accountability, and a healthy culture — a shared operating system across every company in the portfolio.
            </p>
          </AnimatedSection>

          <div className="grid gap-8 border-y border-[rgba(27,29,31,0.14)] py-8 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["Operating System", "EOS — Traction", "A full Organizational Checkup at engagement kickoff, repeated at the 12-month mark to measure movement. The live scoring tool is included below as Appendix A."],
              ["Culture & Team", "The Five Dysfunctions of a Team", "Our shared language for healthy team dynamics — trust, conflict, commitment, accountability, and results."],
              ["Management", "The Effective Manager", "Our baseline standard for people leadership across every operator in the portfolio."],
              ["Marketing Strategy", "StoryBrand", "Clear, customer-centered messaging discipline applied consistently across the portfolio."],
              ["Customer Experience", "Never Lose a Customer Again", "Joey Coleman's framework for retention and building a remarkable customer experience."],
              ["Employee Engagement", "Gallup Q12", "Or an equivalent engagement survey, measured on a regular cadence across every company."],
              ["Hiring & Talent", "Who — Topgrading", "Supported by Predictive Index and Kolbe assessments to round out the hiring picture."]
            ].map(([tag, title, desc]) => (
              <AnimatedSection key={title} className="group flex flex-col border-t border-[rgba(27,29,31,0.14)] pt-6 md:border-t-0 md:pt-0 cursor-default">
                <span className="mb-4 block font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--brass)] transition-colors duration-500 group-hover:opacity-80">{tag}</span>
                <h3 className="mb-3 font-serif text-[20px] font-medium transition-colors duration-500 group-hover:text-[var(--brass)]">{title}</h3>
                <p className="text-[13.5px] leading-[1.6] text-[rgba(27,29,31,0.62)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.85)]">{desc}</p>
              </AnimatedSection>
            ))}
          </div>
          
          <AnimatedSection className="mt-10 border-l-2 border-[var(--brass)] pl-6">
            <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] max-w-4xl">
              The full 20-point EOS Organizational Checkup — the instrument referenced above — is built out as an interactive, self-scoring tool in <Link href="#eos" className="border-b border-[var(--brass)] pb-[1px] text-[var(--ink)] font-medium transition hover:text-[var(--brass)]">Appendix A</Link>. Score it live at kickoff, save the result, and re-run it at month 12 to track the delta.
            </p>
          </AnimatedSection>
        </div>
      </section>

      <section id="s02" className="bg-[var(--paper-2)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
                02 — Standard Operating Procedures &amp; Tools
              </p>
              <h2 className="mt-3 max-w-xl font-serif text-[clamp(1.75rem,3vw,2.6rem)] font-medium">
                One documented, scalable stack
              </h2>
            </div>
            <p className="max-w-[400px] text-[15px] leading-[1.6] text-[rgba(27,29,31,0.65)]">
              Our rule is simple: everything must be documented. We rely on a consistent, scalable technology stack to remove bottlenecks and keep momentum.
            </p>
          </AnimatedSection>

          <div className="border-t border-[rgba(27,29,31,0.14)]">
            {[
              ["Documentation", "Trainual serves as the central repository for every SOP and training resource across the company."],
              ["HR & Payroll", "Gusto handles HR administration, payroll, and benefits compliance."],
              ["Bookkeeping", "Day-to-day bookkeeping managed in-house."],
              ["Strategic Finance", "Managed by our CFO, using a centralized CFO dashboard for visibility."],
              ["Marketing", "In-house marketing team or agency partner, depending on the company."],
              ["Communication & Storage", "Slack — including heavy use of Slack audio — and Google Drive for comms and file storage."],
              ["CRM", "An industry-specific CRM, selected to fit each company's needs."]
            ].map(([title, desc]) => (
              <AnimatedSection key={title} className="group grid gap-4 border-b border-[rgba(27,29,31,0.14)] py-6 md:grid-cols-[200px_minmax(0,1fr)] cursor-default">
                <h4 className="font-mono text-[12px] uppercase tracking-[0.04em] text-[var(--brass)] transition-colors duration-500 group-hover:opacity-80">{title}</h4>
                <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.95)]">{desc}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="s03" className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
                03 — Financial &amp; Corporate Governance
              </p>
              <h2 className="mt-3 max-w-xl font-serif text-[clamp(1.75rem,3vw,2.6rem)] font-medium">
                A tight, disciplined grip on financial health
              </h2>
            </div>
            <p className="max-w-[400px] text-[15px] leading-[1.6] text-[rgba(27,29,31,0.65)]">
              Visibility and accountability are non-negotiable, so decisions can always be made with confidence.
            </p>
          </AnimatedSection>

          <div className="border-t border-[rgba(27,29,31,0.14)]">
            {[
              ["Bookkeeping", "Owned in-house, keeping day-to-day records accurate and current."],
              ["Strategic Finance", "Owned by our CFO, supported by a centralized CFO dashboard."],
              ["Review Routine", "A full monthly review of financial statements across the portfolio."]
            ].map(([title, desc]) => (
              <AnimatedSection key={title} className="group grid gap-4 border-b border-[rgba(27,29,31,0.14)] py-6 md:grid-cols-[200px_minmax(0,1fr)] cursor-default">
                <h4 className="font-mono text-[12px] uppercase tracking-[0.04em] text-[var(--brass)] transition-colors duration-500 group-hover:opacity-80">{title}</h4>
                <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.95)]">{desc}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="s04" className="bg-[var(--paper-2)] px-6 py-24 lg:px-8 border-t border-[rgba(27,29,31,0.14)]">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
                04 — Communication &amp; Meeting Cadence
              </p>
              <h2 className="mt-3 max-w-xl font-serif text-[clamp(1.75rem,3vw,2.6rem)] font-medium">
                A predictable rhythm
              </h2>
            </div>
            <p className="max-w-[400px] text-[15px] leading-[1.6] text-[rgba(27,29,31,0.65)]">
              A predictable rhythm keeps every company aligned without adding unnecessary meetings.
            </p>
          </AnimatedSection>

          <div className="grid gap-12 md:grid-cols-2 border-t border-[rgba(27,29,31,0.14)] pt-12">
            <AnimatedSection>
              <h4 className="font-mono text-[12px] uppercase tracking-[0.04em] text-[var(--brass)] mb-6">Weekly Rhythm</h4>
              <div className="space-y-6">
                <div className="group cursor-default">
                  <b className="block font-serif text-[18px] font-medium text-[var(--ink)] mb-1 transition-colors duration-500 group-hover:text-[var(--brass)]">L10 Meetings</b>
                  <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.95)]">The operator runs the weekly Level 10 meeting.</p>
                  <p className="text-[13px] italic text-[rgba(27,29,31,0.5)] mt-1 transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.8)]">Tanner will never attend L10s.</p>
                </div>
                <div className="group cursor-default">
                  <b className="block font-serif text-[18px] font-medium text-[var(--ink)] mb-1 transition-colors duration-500 group-hover:text-[var(--brass)]">Weekly Update</b>
                  <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.95)]">A Loom video summarizing the scorecard and any key issues.</p>
                </div>
                <div className="group cursor-default">
                  <b className="block font-serif text-[18px] font-medium text-[var(--ink)] mb-1 transition-colors duration-500 group-hover:text-[var(--brass)]">Day to Day</b>
                  <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.95)]">Slack audio for quick, informal unblocking.</p>
                </div>
              </div>
            </AnimatedSection>
            
            <AnimatedSection>
              <h4 className="font-mono text-[12px] uppercase tracking-[0.04em] text-[var(--brass)] mb-6">Monthly &amp; Quarterly</h4>
              <div className="space-y-6">
                <div className="group cursor-default">
                  <b className="block font-serif text-[18px] font-medium text-[var(--ink)] mb-1 transition-colors duration-500 group-hover:text-[var(--brass)]">Monthly</b>
                  <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.95)]">A Same Page meeting with Tanner.</p>
                </div>
                <div className="group cursor-default">
                  <b className="block font-serif text-[18px] font-medium text-[var(--ink)] mb-1 transition-colors duration-500 group-hover:text-[var(--brass)]">Quarterly</b>
                  <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.95)]">Strategic planning sessions with Tanner.</p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      <section id="s05" className="px-6 py-24 lg:px-8 border-t border-[rgba(27,29,31,0.14)]">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
                05 — Partner Growth &amp; Milestones
              </p>
              <h2 className="mt-3 max-w-xl font-serif text-[clamp(1.75rem,3vw,2.6rem)] font-medium">
                Investing in the leaders we work with
              </h2>
            </div>
            <p className="max-w-[400px] text-[15px] leading-[1.6] text-[rgba(27,29,31,0.65)]">
              We invest in the continuous development of the leaders we work with.
            </p>
          </AnimatedSection>

          <AnimatedSection className="bg-[var(--ink)] text-[var(--cream)] p-8 md:p-12 relative overflow-hidden mt-8 rounded-sm">
            <div className="absolute right-6 top-2 font-serif text-[160px] font-semibold text-[rgba(245,242,236,0.03)] leading-none pointer-events-none">
              SC
            </div>
            <h4 className="font-mono text-[12px] uppercase tracking-[0.1em] text-[#C7A667] font-bold mb-6 relative z-10 transition-colors duration-500 hover:text-white cursor-default">
              Strategic Coach Program
            </h4>
            <ul className="relative z-10 space-y-3 max-w-2xl">
              <li className="text-[rgba(245,242,236,0.85)] text-[15px] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-[#C7A667] transition-colors duration-500 hover:text-white cursor-default">
                An Operating Partner joins the Strategic Coach program upon reaching $1MM in revenue.
              </li>
              <li className="text-[rgba(245,242,236,0.85)] text-[15px] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-[#C7A667] transition-colors duration-500 hover:text-white cursor-default">
                Requirement: the participant must be earning $200K+ per year.
              </li>
            </ul>
          </AnimatedSection>
        </div>
      </section>

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

      <footer className="bg-[var(--ink)] border-t border-[rgba(245,242,236,0.16)] text-[rgba(245,242,236,0.55)] text-center px-6 py-10 font-mono text-[11px] uppercase tracking-[0.1em]">
        TAGR Holdings — <b className="text-[var(--cream)] font-medium">Confidential</b> — Operating Playbook — Portfolio Executive Framework 2026
      </footer>
      {/* <ScrollToTop /> */}
    </div>
  );
}
