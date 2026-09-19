import Link from "next/link";
import { ArrowUpRight, BookOpen, Coins, FolderKanban, Inbox, ListChecks, Mail, Radar, Target, Users } from "lucide-react";
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
  /** Ordered walkthrough, rendered as a numbered list before `controls`. */
  steps?: [title: string, body: string][];
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
      "Everything in the CRM is built from four things: leads, projects, activities and contacts. A lead is a company or person you might do business with. A project is any piece of work you track in stages. Activities are the tasks, calls and meetings that move leads and projects forward. Contacts are the people behind all of it. Leads can come from you, or from the lead engine, which searches for businesses automatically and drops what it finds in the Leads Inbox for you to review.",
    tips: [
      "The path of a business: the lead engine finds it (or you add it by hand, or it arrives by email) → it waits in the Leads Inbox → you click Add to pipeline → it becomes a card on the Leads board → the deal moves through the stages (and can spawn Projects).",
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
      "The review queue for everything the lead engine discovered. Nothing here is a real lead yet — it's a candidate waiting for your decision. The number on the sidebar item is how many are still unreviewed.",
    controls: [
      ["Paste a link or text (top)", "Adds a lead by hand: paste a link (the CRM opens the page and reads it) or paste the text of a listing, then press Add (or Enter). The new lead shows up immediately as “Reading and extracting details…” and fills in when the AI step finishes. If a site blocks the CRM from reading the page, the link is still saved and you're told to paste the page's text instead."],
      ["New / Added / Dismissed", "Filters the queue. New = not reviewed yet. Added = you sent it to the pipeline. Dismissed = you archived it. The number on each is how many are in it."],
      ["Search", "Filters by business name, industry or city."],
      ["Fit / Best fit", "When a search profile has qualification criteria, each lead it found gets a badge: Match, Partial, Miss or Unknown, and “Best fit” sorts the best first. Nothing is ever hidden or deleted for missing a criterion — a figure the source didn't state counts as Unknown, not a miss."],
      ["Clicking a row", "Opens the details the engine collected: what the business does, phone, email, website, asking price, revenue, why the owner is selling (when a listing says so), and signals such as “retiring”."],
      ["Add to pipeline", "Turns the candidate into a card on the Leads board, in the first stage (Sourced). It also creates the organization and, if the engine found one, a contact — and copies everything it knows into the card's notes. The row moves to Added."],
      ["Dismiss (✕)", "Archives it. Nothing is deleted, and the engine will not bring the same business back."],
      ["Restore", "On a dismissed row: moves it back to New."],
      ["View original listing", "Opens the page (Google Maps, the search result or the marketplace listing) the engine found it on."],
    ],
    tips: [
      "What the engine has cost so far is on the Engine spend tab, not on this page — that tab has the totals and the full breakdown.",
      "The list shows 10 leads per page; use Previous / Next under the table. Changing the tab, the search or the sort takes you back to page 1.",
      "A candidate can show fewer details than another — the engine only fills in what the source actually said. Empty means unknown, never a guess.",
      "Leads reach the inbox three ways: the engine's scheduled searches, you adding one by hand (the box at the top, the phone's Share button, or the ingest API), and listing emails sent to the leads inbox. The Source column says which.",
      "On an Android phone with the CRM installed, Share → TAGR CRM from any page opens the inbox with that link already in the box. (iPhones don't support this.)",
    ],
  },
  {
    id: "leads",
    title: "Leads",
    href: "/leads",
    icon: Target,
    summary:
      "Every potential deal you're actively working, from first contact to closed — leads you added from the Leads Inbox, plus any you create by hand. Leads move through fixed stages: Sourced → Outreach → In Discussion → Offer Submitted → Diligence → Closed.",
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
    id: "search-profiles",
    title: "Search profiles",
    href: "/leads-inbox/profiles",
    icon: Radar,
    summary:
      "A search profile tells the engine what to look for and where — for example “HVAC contractors within 25 miles of Phoenix, AZ”. To search a new industry or city, you add a profile; nothing needs to be programmed.",
    controls: [
      ["New profile", "Create one. Give it a name, a category (“HVAC contractors”), optional extra search terms, a city and state, and a radius."],
      ["Extra search terms", "Each term is searched separately, in addition to the category (“air conditioning repair”, “heating installation”). More terms find more businesses — and cost more, because every search is a paid call."],
      ["Sources", "Google Places finds local businesses by category and area. Brave Search finds company websites by keyword. Marketplaces reads “businesses for sale” listings (BizBuySell) — currently shelved because the site blocks automated visitors, so leave it off. Company websites lets the engine read each business's own site for contact details — it doesn't find new businesses on its own."],
      ["Max new leads / run", "The main spend guard. A run stops as soon as it has added this many new leads; the next run continues from where it stopped."],
      ["Run every (hours)", "The minimum time between runs of this profile. The engine may check more often, but it skips a profile that ran more recently than this."],
      ["Qualification criteria", "Optional: min/max revenue, min/max profit (cash flow), max asking price, min/max employees, minimum years in business, and signal keywords like “retiring” or “owner selling”. Each lead the profile finds is flagged Match / Partial / Miss / Unknown against them in the Leads Inbox — it annotates, it never discards. Editing the criteria re-scores existing leads at once."],
      ["Run now", "Runs this profile outside its schedule. The request is saved and the engine picks it up; if the CRM is connected to GitHub it starts within a minute or two, otherwise it starts with the next scheduled run (the button shows “Queued” until then). The profile's “max new leads” still applies, so a run can't cost more than usual. A paused profile can't be run."],
      ["Pause / Resume", "A paused profile is skipped entirely — no searches, no cost — and keeps its settings and history."],
      ["Clicking a row", "Edit the profile. Changes apply from the next run."],
      ["Last run", "When the profile last completed its work. “Never” means the engine hasn't run it yet."],
    ],
    tips: [
      "Profiles are never deleted, because past leads and costs refer to them. Pause one instead.",
      "Criteria only judge what a source actually states. A Google Maps record almost never has revenue, so most Places leads show Unknown; listings and emails that state figures get a real Match or Miss.",
    ],
  },
  {
    id: "email-sources",
    title: "Email sources",
    href: "/leads-inbox/email-sources",
    icon: Mail,
    summary:
      "Some listing sites don't have a page to browse — they only email their listings. This screen is your list of those sites and whether the leads inbox is subscribed to each. Receiving and reading the emails is automatic; signing up to a site is a separate step, and only partly automatic.",
    steps: [
      ["The site gets on the list", "Two ways. You can add it yourself (name and signup page). Or the engine adds it while it searches: when it reads a company's website and finds a form with an email box next to wording like “subscribe”, “get listings by email”, “email alerts” or “sign up to receive”, it adds that site here on its own, marked “Found by the engine”. It only does this when it's fairly sure — both the email box and the wording must be in the same form — so it will miss some sites; add those by hand."],
      ["The inbox is signed up", "Either you do it yourself on the site, using the leads inbox address shown on this screen, or — if the site's form has no captcha — the engine does it for you. For that, give the site the two selectors (the email box and the submit button) and click Attempt subscribe."],
      ["The site asks you to confirm", "Most sites send a “confirm your subscription” email first. When it reaches the leads inbox, the CRM recognises it, opens the confirmation link for you and marks the site Subscribed. That email does not become a lead."],
      ["Listings arrive", "From then on every email the site sends is read automatically — the same AI step as everything else — and lands in the Leads Inbox as a lead from “Email digest”."],
    ],
    controls: [
      ["Add site", "Name, signup page and, optionally, the two selectors for automatic signup. Tick “This form has a captcha” if you know it does."],
      ["Ready to attempt", "Both selectors are set and the engine hasn't tried yet. It tries on its next scheduled run (or when you click Attempt subscribe) — never repeatedly by itself. Sites the engine found on its own arrive here already filled in, so they are signed up automatically unless there's a captcha. Check the “Found by the engine” ones and remove any that don't belong."],
      ["Attempt subscribe / Retry signup", "Queues an automatic signup. The engine opens the page, types the leads inbox address into the email box and clicks the button. It does NOT mark the site subscribed — that only happens when the confirmation email arrives."],
      ["Waiting for confirmation email", "The form was submitted. If the confirmation never arrives, check spam settings or Retry signup."],
      ["Captcha — sign up by hand", "The engine found a captcha and stopped: it never solves or works around one. Sign up yourself, then click Mark subscribed."],
      ["Last attempt failed", "Usually a selector that no longer matches the page. The reason is shown in the row; fix the selector and retry."],
      ["Mark subscribed / Mark not subscribed", "For sites you signed up to yourself, or to undo a mistake."],
    ],
    tips: [
      "The CRM can't sign up for you on sites with a captcha — that stays manual by design. Finding sites that need an email signup is best-effort: the engine catches the obvious ones while it searches, but a signup form that only appears through JavaScript, or that doesn't use wording like “subscribe”, will be missed — add those yourself.",
      "A confirmation email the CRM isn't sure about (it can't tie it to exactly one site on your list) is not clicked and not skipped: it shows up in the Leads Inbox as an ordinary email lead, where you can see it and click the link yourself.",
      "One email becomes one lead. If a digest lists ten businesses, you get one lead with the most prominent one filled in — the full email text is kept on the lead.",
    ],
  },
  {
    id: "engine-spend",
    title: "Engine spend",
    href: "/leads-inbox/spend",
    icon: Coins,
    summary:
      "What the lead engine has cost, in US dollars, itemized: which service (Google Places, Brave Search, Google Geocoding, OpenAI, Resend for inbound email), for what kind of call, how many calls, how many AI tokens, and which search profile and run caused it. Leads you add by hand and listing emails don't belong to a profile, so they appear as their own line, “Manual & email leads”.",
    controls: [
      ["Total / This month / Last 7 days", "Spend in each window."],
      ["Cost per lead", "Total spend divided by the number of new leads the engine has found — the number to watch when judging whether a profile is worth its cost."],
      ["By service", "Each provider's share of the total."],
      ["Detail", "Every kind of call with its volume and cost. AI calls also show tokens in / out (the amount of text sent to and returned by the model)."],
      ["Last 30 days", "A bar per day. Hover a bar for that day's amount."],
      ["By search profile", "Runs, leads found, cost per lead and total cost for each profile."],
      ["Recent runs", "The last runs: when they started, which profile, whether they finished, how many candidates they looked at, how many were new, how many new email-only sites the run added to Email sources, and what the run cost. A run marked “Stopped early” hit its time limit and will resume; hover a “Failed” run for the reason."],
    ],
    tips: [
      "These amounts are estimates. Each call is priced at the provider's public list price at the time it's made. Free monthly allowances and credits are not subtracted, so your real invoice can be lower. The authoritative numbers are Google Cloud Billing and the OpenAI usage page.",
      "If a provider changes its prices, they're updated in one file (scraper/src/leadengine/pricing.py); entries already recorded keep the price they were recorded at.",
    ],
  },
  {
    id: "lead-engine",
    title: "How the lead engine works",
    icon: Radar,
    summary:
      "The lead engine is a separate program that does what you would otherwise do by hand: search several places for businesses that might be worth acquiring, and gather them in one spot. It does not judge them — that stays with you — and it never talks to the CRM directly: it reads your search profiles from the shared database and writes what it finds back into it.",
    steps: [
      ["It wakes up on a schedule", "A scheduler (GitHub Actions, every 6 hours) starts the engine. Only one copy can run at a time."],
      ["It picks the profiles that are due", "It takes every active search profile that has never run, whose “run every” time has passed, that you asked to Run now, or that was cut short last time and needs to resume. Paused profiles are ignored."],
      ["It searches each source", "For each profile it takes the category plus each extra search term and searches the sources you switched on: Google Places (local businesses near the city, within the radius), Brave Search (company websites found by keyword, up to 60 results per term), and marketplace listings (shelved). Everything goes through the providers' official APIs — the engine never scrapes a search engine's result pages. Directories, social profiles and “15 best … in Phoenix” roundup pages are dropped at this point, before they can cost anything."],
      ["It skips what it already knows", "Every candidate has a stable identity (a Google place id, a website, a listing number). If it's already in the inbox — new, added or dismissed — the engine drops it right there, before spending anything on it. This is why dismissing works, and why re-running is safe."],
      ["It reads the business's website", "If the profile has Company websites on and the candidate has a site, the engine reads the homepage and one contact/about page for email addresses, phone numbers and a sense of the business. It obeys the site's robots.txt, waits between requests, and refuses private or internal addresses."],
      ["AI extraction turns text into fields", "All the text collected about the candidate (the Google record, the search snippet or listing, the website text) is sent to an AI model (OpenAI for now), which fills a fixed form: business name, industry, one-sentence summary, address, contact, revenue, asking price, reason for selling, employees, years in business, and short “signals”. It is told to leave a field empty rather than guess. It also reads any figures stated as numbers (revenue, profit, asking price, employees) so they can be checked against your search profile's criteria. If the AI is unavailable, the lead is still saved with what the source itself provided."],
      ["It saves a raw lead", "The candidate is stored in the Leads Inbox with the original text kept alongside the extracted fields, for audit or re-processing. If the profile has signal keywords (“retiring”…), the lead's full text is scanned for them and the hits are kept. Each lead belongs to the company (tenant) of the profile that found it."],
      ["It records what it spent", "Every paid call — each Google request and each AI call with its token counts — is logged with its estimated cost the moment it happens. That's what the Engine spend page shows."],
      ["It stops at a limit and remembers where", "A run ends when it has added the profile's “max new leads”, or when it runs low on time. Either way it saves a checkpoint (which source and search term it was on), so the next run picks up from there instead of starting over."],
      ["You review", "New candidates show up in the Leads Inbox. Add to pipeline sends one to the Leads board; Dismiss archives it."],
    ],
    controls: [
      ["Candidate / raw lead", "Something the engine found that you haven't reviewed. It only becomes a real lead when you click Add to pipeline."],
      ["Source", "Where it was found: Google Places, Brave Search, Marketplace, or Company site."],
      ["Run", "One pass of the engine over one profile. Each run has a status: Completed, Stopped early (time limit — it resumes), or Failed."],
      ["Cap", "A profile's “max new leads per run” — the ceiling that limits how much one run can spend."],
      ["Checkpoint", "The engine's bookmark inside a profile, so a stopped run resumes instead of repeating work."],
      ["Extraction", "The AI step that reads messy text and fills the structured fields. It reports; it does not score or rank."],
    ],
    tips: [
      "Not everything comes from the scheduled searches: you can add a lead by hand (the box at the top of the Leads Inbox, or a link/text shared from your phone), and emails sent to the leads inbox become leads automatically. All of them go through the same AI extraction and are tracked on the same spend page.",
      "Subscribing to a listing site is a separate step from receiving its emails — see Email sources. The engine can fill in a signup form only where there's no captcha, and it never marks a site subscribed itself: the site's confirmation email does that.",
      "What is deliberately not built yet: scoring or ranking leads with AI, merging the same business found by two different sources, splitting a multi-listing email into one lead per listing, and drafting outreach. The qualification criteria on a search profile (revenue, profit, size, signal keywords) already flag each lead Match / Partial / Miss / Unknown, but nothing is ever discarded for missing them.",
      "Nothing shows up? Check, in order: the profile is Active; it has at least one source that finds businesses; “Last run” isn't recent (the profile may simply not be due — its “run every” time hasn't passed); the latest run on Engine spend isn't Failed; and, for the Brave Search source, that a Brave API key is configured for the engine (a run whose only source is unconfigured shows it as a note and finds nothing).",
      "Marketplace listing sites actively block automated visitors. The engine follows their rules and gives up politely when it's blocked (the run shows a note); it never tries to get around a block. Expect some runs to return nothing from that source.",
      "Safeguards: a profile can't add more than its cap per run; the engine can only write to your own company's data (the database enforces it, not just the code); it can't edit your profiles' settings; and one failing source never stops the others.",
      "Costs to expect: about US$ 0.035 per page of 20 Google Places results, US$ 0.005 per Brave Search request (up to 20 results each), and roughly US$ 0.0003 per AI extraction with the current model — so a 25-lead run is typically well under US$ 0.25. Check Engine spend for the real figures.",
    ],
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
      ["Board / List, search, item panel", "Work exactly like the Leads board (see above), including adding activities from an item's panel."],
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

              {section.steps && (
                <ol className="mt-5 space-y-3">
                  {section.steps.map(([title, body], index) => (
                    <li key={title} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-ink">
                        {index + 1}
                      </span>
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-foreground">{title}</p>
                        <p className="mt-0.5 leading-relaxed text-muted-foreground">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

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
