import "server-only";
import Link from "next/link";
import { AnimatedSection } from "@/components/landing/animated-section";
import { HeroHeader } from "@/components/shared/hero-header";
import { NavBar } from "@/components/shared/nav-bar";
import { EosCheckup } from "./eos-checkup";
import { ScrollToButton } from "./scroll-to-button";
import { UrgencyIndex } from "./urgency-index";

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

const urgencyStatements = [
  "I seem to do my best work when I'm under pressure.",
  "I often blame the rush and press of external things for my failure to spend deep, introspective time with myself.",
  "I'm often frustrated by the slowness of people and things around me. I hate to wait or stand in line.",
  "I feel guilty when I take time off work.",
  "I always seem to be rushing between places and events.",
  "I frequently find myself pushing people away so that I can finish a project.",
  "I feel anxious when I'm out of touch with the office for more than a few minutes.",
  "I'm often preoccupied with one thing when I'm doing something else.",
  "I'm at my best when I'm handling a crisis situation.",
  "The adrenaline rush from a new crisis seems more satisfying to me than the steady accomplishment of long-term results.",
  "I often give up quality time with important people in my life to handle a crisis.",
  "I assume people will naturally understand if I have to disappoint them or let things go in order to handle a crisis.",
  "I rely on solving some crisis to give my day a sense of meaning and purpose.",
  "I often eat lunch or other meals while I work.",
  "I keep thinking that someday I'll be able to do what I really want to do.",
  "Accomplishing a lot of tasks makes me feel like I've been really productive.",
];

// Ascending by `min`. Totals run 0–64 (16 statements × 0–4). Cutoffs are the
// book's own key (Habit 3, p. 206): 0–25 / 26–45 / 46+.
const urgencyBands = [
  {
    min: 0,
    label: "Low urgency mindset",
    color: "#9bc79b",
    summary: "Urgency is not driving your days. Protect what is working: keep making room for the important-but-not-urgent work — planning, relationships, and prevention — before the day fills up.",
  },
  {
    min: 26,
    label: "Strong urgency mindset",
    color: "#e0a25f",
    summary: "Urgency is setting your agenda more often than you are. Start with one weekly planning session and one protected block for a non-urgent priority, and treat both as non-negotiable.",
  },
  {
    min: 46,
    label: "Urgency addiction",
    color: "#d98a7c",
    summary: "Crisis and speed have become the way the day gets its meaning. This is worth a direct conversation with your operating partner: reduce commitments, rebuild a weekly planning habit, and re-run this index in 30 days.",
  },
];

const navLinks = [
  { href: "#s01", label: "Methodologies" },
  { href: "#s02", label: "SOPs & Tools" },
  { href: "#s03", label: "Governance" },
  { href: "#s04", label: "Cadence" },
  { href: "#s05", label: "Growth" },
  { href: "#eos", label: "EOS Checkup" },
  { href: "#urgency", label: "Urgency Index" },
];

/**
 * Server Component on purpose — this is the confidential content behind the
 * portal token. As a "use client" module it shipped in the route's public JS
 * chunk, readable without any token. Only the interactive pieces
 * (EosCheckup, ScrollToButton) are client islands, and they receive their
 * text as props, which is only serialized when app/portal/page.tsx renders
 * this after verifying the token.
 */
export function OperatingPlaybook() {
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
            <ScrollToButton
              targetId="s01"
              className="rounded-full bg-[var(--brass)] px-6 py-3 font-mono text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink)] transition-colors hover:bg-white"
            >
              Explore Framework
            </ScrollToButton>
            <ScrollToButton
              targetId="eos"
              className="rounded-full border border-[rgba(245,242,236,0.2)] px-6 py-3 font-mono text-[11.5px] uppercase tracking-[0.06em] text-[var(--cream)] transition-colors hover:border-[var(--brass)] hover:bg-[rgba(199,166,103,0.05)]"
            >
              EOS Checkup
            </ScrollToButton>
          </div>
        }
      >
        <div className="mt-16 grid grid-cols-2 gap-8 pt-10 md:grid-cols-4">
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
              The full 20-point EOS Organizational Checkup — the instrument referenced above — is built out as an interactive, self-scoring tool in <Link href="#eos" className="border-b border-[var(--brass)] pb-[1px] text-[var(--ink)] font-medium transition hover:text-[var(--brass)]">Appendix A</Link>. Score it live at kickoff, save the result, and re-run it at month 12 to track the delta. Its companion, the 16-statement<Link href="#urgency" className="border-b border-[var(--brass)] pb-[1px] text-[var(--ink)] font-medium transition hover:text-[var(--brass)]">Urgency Index (Appendix B)</Link>, measures how much of an operator&apos;s day is run by urgency rather than importance.
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

      <EosCheckup statements={statements} />
      <UrgencyIndex statements={urgencyStatements} bands={urgencyBands} />

      <footer className="bg-[var(--ink)] border-t border-[rgba(245,242,236,0.16)] text-[rgba(245,242,236,0.55)] text-center px-6 py-10 font-mono text-[11px] uppercase tracking-[0.1em]">
        TAGR Holdings — <b className="text-[var(--cream)] font-medium">Confidential</b> — Operating Playbook — Portfolio Executive Framework 2026
      </footer>
      {/* <ScrollToTop /> */}
    </div>
  );
}
