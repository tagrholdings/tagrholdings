import "server-only";
import type { ReactNode } from "react";
import Link from "next/link";
import { HeroHeader } from "@/components/shared/hero-header";
import { NavBar } from "@/components/shared/nav-bar";
import { EosCheckup } from "./eos-checkup";
import { UrgencyIndex } from "./urgency-index";
import { ToolsTabs, type PortalToolId } from "./tools-tabs";

export type { PortalToolId };

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

/**
 * Server Component on purpose, for the same reason as OperatingPlaybook: the
 * statements below are the confidential content behind the portal token, and
 * only reach the client as props after app/portal/tools/page.tsx has verified it.
 */
export function PortalTools({
  initialTool,
  playbookHref,
  toolsHref,
  contact,
}: {
  initialTool: PortalToolId;
  playbookHref: string;
  toolsHref: string;
  contact: ReactNode;
}) {
  const navLinks = [
    { href: playbookHref, label: "Playbook" },
    { href: toolsHref, label: "Tools" },
  ];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] selection:bg-[var(--brass)] selection:text-[var(--ink)]">
      <NavBar links={navLinks} contact={contact} />

      <HeroHeader
        compact
        kicker="Portfolio Executive Framework · 2026"
        title={
          <>
            Portal <em className="not-italic text-[#C7A667]">Tools</em>
          </>
        }
        description="Two short self-assessments — one for the company, one for the operator. Pick one, score it live, and save your result."
        actions={
          <Link
            href={playbookHref}
            className="mt-8 inline-block font-mono text-[11.5px] uppercase tracking-[0.06em] text-[rgba(245,242,236,0.72)] transition-colors hover:text-[var(--brass)]"
          >
            ← Back to the Playbook
          </Link>
        }
      />

      <ToolsTabs
        initialTool={initialTool}
        tabs={[
          {
            id: "eos",
            number: "01",
            title: "EOS Checkup",
            blurb: "Rate the company on the 20 EOS statements and get a live organizational score.",
            meta: `${statements.length} statements · ~5 min`,
            content: <EosCheckup statements={statements} />,
          },
          {
            id: "urgency",
            number: "02",
            title: "Urgency Index",
            blurb: "Find out how much of your day is run by what is urgent rather than what is important.",
            meta: `${urgencyStatements.length} statements · ~3 min`,
            content: <UrgencyIndex statements={urgencyStatements} bands={urgencyBands} />,
          },
        ]}
      />

      <footer className="bg-[var(--ink)] border-t border-[rgba(245,242,236,0.16)] text-[rgba(245,242,236,0.55)] text-center px-6 py-10 font-mono text-[11px] uppercase tracking-[0.1em]">
        TAGR Holdings — <b className="text-[var(--cream)] font-medium">Confidential</b> — Portal Tools — Portfolio Executive Framework 2026
      </footer>
    </div>
  );
}
