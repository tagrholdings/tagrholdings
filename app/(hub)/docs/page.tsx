import Link from "next/link";
import { ArrowUpRight, BookOpen, FolderKanban, Inbox, ListChecks, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { initialsFor } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface DocSection {
  id: string;
  title: string;
  href?: string;
  icon: typeof Inbox;
  summary: string;
  /** [control, what it does] */
  controls?: [string, string][];
  tips?: string[];
}

const SECTIONS: DocSection[] = [
  {
    id: "overview",
    title: "How it all fits together",
    icon: BookOpen,
    summary:
      "Everything in the CRM is built from four things: leads, projects, activities and contacts. A lead is a company or person you might do business with. A project is any piece of work you track in stages. Activities are the tasks, calls and meetings that move leads and projects forward. Contacts are the people behind all of it.",
    tips: [
      "Leads and project items are the same kind of card: each has a title, a stage, and optionally an organization, a contact and notes. The only difference is which board it lives on.",
      "An activity created inside a lead or a project item stays linked to it — and it also shows up on the Activities page, so there is only one to-do list.",
      "Link a contact to a lead, project item or activity and you'll see all of it again from that contact's panel on the Contacts page.",
    ],
  },
  {
    id: "leads-inbox",
    title: "Leads Inbox",
    href: "/leads-inbox",
    icon: Inbox,
    summary:
      "Every potential deal, from first contact to closed. Leads move through fixed stages: Sourced → Outreach → In Discussion → Offer Submitted → Diligence → Closed.",
    controls: [
      ["New lead", "Opens a form: title, stage, organization, contact and notes. The card appears on the board right away."],
      ["Board / List toggle", "Board shows one column per stage — drag a card to another column to change its stage. List shows every lead as a row with its organization, contact, stage and activity progress."],
      ["Stage pills (List)", "Filter the list to one stage. The number on each pill is how many leads are in it."],
      ["Search", "Filters by title, organization or contact name."],
      ["Clicking a lead", "Opens its panel: change the stage, see the organization and contact, read the notes, and manage its activities."],
      ["Add activity (in the panel)", "Adds a task, call, meeting, email or follow-up to this lead. It is due today by default so it appears on this week's Activities board."],
    ],
    tips: ['The "4/8" badge on a card means 4 of its 8 activities are done.'],
  },
  {
    id: "projects",
    title: "Projects",
    href: "/pipeline",
    icon: FolderKanban,
    summary:
      "Your own boards, each with the stages you choose — for example \"Vendor onboarding: Contacted → Negotiating → Signed\". Each project is a tab at the top of the page.",
    controls: [
      ["New project", "Name the project and list its stages (up to 10). Stages become the board's columns."],
      ["Project tabs", "Switch between projects. Archived projects are hidden unless you click \"Show archived\"."],
      ["Manage", "Rename, archive, restore or delete projects. Archiving hides the tab but keeps everything. Deleting removes the project and its items for good — their activities are kept on the Activities page."],
      ["New item", "Adds a card to the selected project — same fields as a lead."],
      ["Board / List, search, item panel", "Work exactly like the Leads Inbox (see above), including adding activities from an item's panel."],
    ],
  },
  {
    id: "activities",
    title: "Activities",
    href: "/activities",
    icon: ListChecks,
    summary:
      "The single to-do list. Activities created here, inside a lead, or inside a project item all show up on this page.",
    controls: [
      ["Board", "This week's days (Monday to Sunday) as columns. Drag an activity to another day to reschedule it."],
      ["‹ This week ›", "Go to the previous or next week. Click the label to jump back to this week."],
      ["Due date / Created date", "Choose whether the board places activities by when they're due or when they were created."],
      ["List", "Every activity, open ones first and sorted by due date. Overdue dates are shown in red."],
      ["Filters (List)", "Open, Overdue, Today, Tomorrow, Next 7 days, Done or All."],
      ["Checkbox", "Mark an activity done (or not done)."],
      ["New", "Create an activity: title, type (call, meeting, task, email, follow-up), due date and optional time, priority, notes, who it's assigned to, and which lead/project, person and organization it's linked to."],
      ["Clicking an activity", "Opens its details, with links to the lead/project and contact it belongs to."],
    ],
    tips: ["High-priority activities have a red edge on the board and a HIGH tag in lists."],
  },
  {
    id: "contacts",
    title: "Contacts",
    href: "/contacts",
    icon: Users,
    summary: "Everyone you work with. Click a person to see everything connected to them.",
    controls: [
      ["New", "Add a person with name, email, phone and organization."],
      ["Organization (in the panel)", "Link the person to an organization. Type a name that doesn't exist yet and choose \"Create organization\" to add it on the spot."],
      ["Leads / Projects (in the panel)", "Every lead and project item where this person is the contact, with its current stage. Click one to open it."],
      ["Activities (in the panel)", "Activities about or assigned to this person, with how many are done. Click one to open it on the Activities page."],
      ["Go to full profile", "A full-page view of the contact."],
    ],
  },
];

export default async function DocsPage() {
  const user = await getCurrentUser();

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Help"
      title="How to use the CRM"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav aria-label="On this page" className="rounded-lg border border-divider bg-surface p-4 lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
          <p className="label-kicker mb-2">On this page</p>
          <ul className="space-y-1 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <section.icon className="size-4 shrink-0" />
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 rounded-lg border border-divider bg-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-foreground">
                  <section.icon className="size-5 text-accent" />
                  {section.title}
                </h2>
                {section.href && (
                  <Link href={section.href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover">
                    Open
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                )}
              </div>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground">{section.summary}</p>

              {section.controls && (
                <dl className="mt-5 divide-y divide-divider rounded-lg border border-divider bg-background">
                  {section.controls.map(([control, description]) => (
                    <div key={control} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[12rem_1fr] sm:gap-4">
                      <dt className="font-medium text-foreground">{control}</dt>
                      <dd className="text-muted-foreground">{description}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {section.tips && (
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {section.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </HubPage>
  );
}
