/**
 * The platform tour's table of contents: its five parts and the pages in each. Plain data (no JSX) so it can be
 * tested and so the section bodies in sections.tsx are checked against it by the compiler — a page listed here
 * without a body, or a body without an entry, doesn't build.
 */
export const TOUR_PARTS = [
  {
    id: "intro",
    label: "Intro",
    heading: null,
    sections: [
      { id: "why", title: "Why we built it" },
      { id: "map", title: "The platform at a glance" },
      { id: "words", title: "Words you’ll see" },
      { id: "story", title: "One deal, end to end" },
    ],
  },
  {
    id: "finding",
    label: "1 · Finding deals",
    heading: { num: "01", title: "Finding", em: "deals", lede: "Sourcing: what to look for, where it looks, what it found, what arrived by email, and what it cost." },
    sections: [
      { id: "profiles", title: "Search profiles" },
      { id: "engine", title: "How the lead engine works" },
      { id: "review", title: "Sourcing · Review" },
      { id: "lead-detail", title: "Lead detail & AI fit" },
      { id: "add-lead", title: "Add a lead · Share from phone" },
      { id: "listing-sites", title: "Listing sites" },
      { id: "email-sources", title: "Email sources" },
      { id: "emails", title: "Sourcing · Emails" },
      { id: "spend", title: "Engine spend" },
    ],
  },
  {
    id: "working",
    label: "2 · Working deals",
    heading: { num: "02", title: "Working", em: "deals", lede: "The CRM itself: the deal pipeline, project boards, one to-do list and the people behind every deal." },
    sections: [
      { id: "leads", title: "Leads board" },
      { id: "projects", title: "Projects" },
      { id: "activities", title: "Activities" },
      { id: "contacts", title: "Contacts" },
      { id: "contact-detail", title: "Contact detail" },
    ],
  },
  {
    id: "traction",
    label: "3 · Traction",
    heading: { num: "03", title: "Traction: the", em: "weekly rhythm", lede: "Every company in the portfolio runs EOS the same way. These examples use Grounded Pest Control’s real data, imported from its EOS spreadsheet." },
    sections: [
      { id: "overview", title: "Traction overview" },
      { id: "scorecard", title: "Scorecard" },
      { id: "rocks", title: "Rocks" },
      { id: "issues", title: "Issues (IDS)" },
      { id: "l10", title: "L10 Meeting" },
      { id: "history", title: "Meeting history" },
    ],
  },
  {
    id: "eos",
    label: "4 · EOS foundations",
    heading: { num: "04", title: "EOS: the", em: "foundations", lede: "Vision, People and Process: the parts of EOS that change quarterly or yearly, and the Checkup that measures progress." },
    sections: [
      { id: "setup", title: "Vision · guided setup" },
      { id: "vto", title: "Vision / V/TO" },
      { id: "people", title: "People" },
      { id: "process", title: "Core processes" },
      { id: "checkup", title: "Organizational Checkup" },
    ],
  },
  {
    id: "owner",
    label: "5 · The owner’s view",
    heading: { num: "05", title: "The owner’s", em: "view", lede: "One login, many companies: the Portfolio across all of them, a workspace per company, the partner Portal, and who can see what." },
    sections: [
      { id: "portfolio", title: "Portfolio" },
      { id: "workspaces", title: "Workspaces (multi-company)" },
      { id: "portal", title: "Partner Portal" },
      { id: "you", title: "You, your team & the app" },
      { id: "security", title: "Security & trust" },
      { id: "status", title: "Where we are · next steps" },
    ],
  },
] as const;

export type TourSectionId = (typeof TOUR_PARTS)[number]["sections"][number]["id"];
