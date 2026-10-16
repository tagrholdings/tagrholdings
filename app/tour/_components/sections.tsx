import type { ReactNode } from "react";
import { ActivitiesDemo, CheckupDemo, EmailsDemo, IssuesDemo, L10Demo, LeadsBoardDemo, ReviewDemo, RocksDemo, ScorecardDemo, SetupDemo } from "./demos";
import {
  AddLeadMock,
  ContactDetailMock,
  ContactsMock,
  EmailSourcesMock,
  HistoryMock,
  ListingSitesMock,
  OverviewMock,
  PeopleMock,
  PortalMock,
  PortfolioMock,
  ProcessMock,
  ProfilesMock,
  ProjectsMock,
  SpendMock,
  VtoMock,
  WorkspacesMock,
  LeadDetailMock,
} from "./mocks";
import type { TourSectionId } from "./tour-nav";
import { Badge, Pane, PageSection } from "./ui";

/* The words of every page in the tour. The screens next to them are in demos.tsx (the ones you can click) and mocks.tsx. */

function Steps({ items }: { items: [string, string, string][] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(([n, title, text]) => (
        <li key={n} className="rounded-xl border border-divider bg-surface p-4">
          <p className="font-mono text-[11px] tracking-wider text-accent-text">{n}</p>
          <h3 className="my-1.5 font-serif text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
        </li>
      ))}
    </ol>
  );
}

const grid = (cols: string, children: ReactNode) => <div className={`grid gap-3 ${cols}`}>{children}</div>;

export const SECTION_BODIES: Record<TourSectionId, ReactNode> = {
  /* ───────── Intro ───────── */
  why: (
    <PageSection
      id="why"
      wide
      kicker="Why we built it"
      title="Three jobs that used to live in three different places"
      lede="Before the CRM, finding deals meant browsing broker sites by hand, deal status lived in email threads, and each company’s EOS lived in its own spreadsheet. Now it’s one system, with one login and the same data everywhere."
      notes={[
        "Grounded Pest Control kept its EOS (V/TO, L10, Scorecard) in a spreadsheet. That spreadsheet was imported into the CRM, so the Traction examples in this tour are Grounded’s real data.",
        "The deal examples (fictional HVAC, plumbing and pest-control companies around Phoenix) come from a demo workspace, to show the platform full of data.",
      ]}
    >
      {grid(
        "md:grid-cols-3",
        <>
          <Pane kicker="01 · Find" title="Deal sourcing on autopilot">
            A lead engine reads broker websites, listing emails, Google and Brave search for the industries we want to buy, and an AI pulls out price, revenue, profit and reason for selling.
            <p className="mt-3"><b className="text-foreground">Before:</b> opening dozens of broker sites every week.</p>
            <p><b className="text-foreground">Now:</b> one review queue of what’s new, scored against our buy box.</p>
          </Pane>
          <Pane kicker="02 · Close" title="Every deal, every conversation">
            A board for the deal pipeline, project boards for diligence and integration, and contacts with every call, meeting and email in one history.
            <p className="mt-3"><b className="text-foreground">Before:</b> status in inboxes and memory.</p>
            <p><b className="text-foreground">Now:</b> drag a card, and everyone sees where a deal stands.</p>
          </Pane>
          <Pane kicker="03 · Operate" title="EOS for every company we own">
            Scorecard, Rocks, Issues, the L10 meeting, V/TO, Accountability Chart and Checkup, all connected and rolled up into one Portfolio view for the owner.
            <p className="mt-3"><b className="text-foreground">Before:</b> a spreadsheet per company.</p>
            <p><b className="text-foreground">Now:</b> live data and a Portfolio across all of them.</p>
          </Pane>
        </>
      )}
    </PageSection>
  ),

  map: (
    <PageSection
      id="map"
      wide
      kicker="The platform at a glance"
      title="Every page, grouped the way the app is"
      lede="The sidebar has three groups: CRM, Traction and EOS (the last two fold away with a click). The owner also has Portfolio and Workspaces, and outside the app there’s the partner Portal."
      notes={["Every page in the app has a (?) button that explains it, plus a guided tour that points at each control. Nobody needs long training."]}
    >
      {grid(
        "sm:grid-cols-2 lg:grid-cols-4",
        <>
          <Pane kicker="Sourcing"><ul className="space-y-1"><li>Review (new finds)</li><li>Emails (what arrived)</li><li>Search profiles</li><li>Listing sites</li><li>Email sources</li></ul></Pane>
          <Pane kicker="CRM"><ul className="space-y-1"><li>Leads (deal pipeline)</li><li>Projects (any board)</li><li>Activities (one to-do list)</li><li>Contacts &amp; Organizations</li><li>Team</li></ul></Pane>
          <Pane kicker="Traction · weekly"><ul className="space-y-1"><li>Overview</li><li>Scorecard</li><li>Rocks</li><li>Issues (IDS)</li><li>L10 Meeting &amp; history</li></ul></Pane>
          <Pane kicker="EOS · foundations"><ul className="space-y-1"><li>Vision (V/TO)</li><li>People (Chart + Analyzer)</li><li>Core processes</li><li>Organizational Checkup</li></ul></Pane>
        </>
      )}
      {grid(
        "md:grid-cols-3",
        <>
          <Pane><b className="text-foreground">Owner:</b> Portfolio · Workspaces (one per company)</Pane>
          <Pane><b className="text-foreground">You:</b> Profile · Notifications · Settings · Documentation</Pane>
          <Pane><b className="text-foreground">Outside:</b> Partner Portal · Share-to-CRM from the phone</Pane>
        </>
      )}
    </PageSection>
  ),

  words: (
    <PageSection
      id="words"
      wide
      kicker="Before we start"
      title="Words you’ll see"
      lede="Most of the vocabulary comes from M&A or from EOS, the operating system our companies run on."
      notes={["Two more you’ll meet: the V/TO (Vision/Traction Organizer, the company’s plan on one page) and a To-Do (a 7-day commitment from the L10, kept in Activities)."]}
    >
      {grid(
        "sm:grid-cols-2 lg:grid-cols-4",
        <>
          {[
            ["Lead", "A company we might buy or work with, on the Leads board, moving through stages until it closes."],
            ["Sourcing", "Where deals are found before we work them: the engine’s finds, listing emails and anything added by hand wait in Review."],
            ["Buy box / Fit", "What we want to buy (industry, area, revenue, profit, price). Each find gets a Fit badge against it."],
            ["Workspace", "One company. Its own people, data and inbox address. One login can belong to several."],
            ["EOS", "The Entrepreneurial Operating System: a simple, proven way to run a company — vision, people, data, issues, process, traction."],
            ["Rock", "A 90-day priority with one owner and a clear finish line. 3–7 per quarter."],
            ["Scorecard", "The 5–15 numbers that say how the company is doing, entered every week or month."],
            ["L10 · IDS", "The weekly 90-minute leadership meeting. Its core is IDS: Identify, Discuss, Solve the top issues."],
          ].map(([term, text]) => (
            <Pane key={term} title={term}>{text}</Pane>
          ))}
        </>
      )}
    </PageSection>
  ),

  story: (
    <PageSection
      id="story"
      wide
      kicker="One deal, end to end"
      title="From a broker’s website to a company running on EOS"
      lede="The path of a realistic deal in the demo workspace: Cool Air Mechanical, an HVAC contractor in Phoenix whose owner is retiring."
      example={{ tag: "Why it matters", text: "Each step is the same record. The contact you met in step 3 is the one on the diligence checklist, the activities, and the closing meeting. Nothing is retyped." }}
      notes={["Cool Air Mechanical is a fictional company from the demo workspace, but the flow is exactly what the platform does."]}
    >
      <Steps
        items={[
          ["01 · PROFILE", "We say what to buy", "“HVAC, Phoenix, 40 mi, revenue $1–5M, profit ≥ $250K, asking ≤ $3.5M, mentions retiring.”"],
          ["02 · ENGINE", "It finds and reads", "Broker sites, listing emails and search. The AI extracts price, revenue, profit, employees and reason for selling."],
          ["03 · REVIEW", "We decide", "“Established Phoenix HVAC, 24 yrs” arrives as Match · In area. One click: Add to pipeline."],
          ["04 · PIPELINE", "We work it", "Sourced → Outreach → In Discussion → Offer → Diligence. Calls with the owner, LOI with counsel, lender package."],
          ["05 · OPERATE", "We run it", "Closed: an integration project, then its own workspace with Scorecard, Rocks and a weekly L10, rolled into the Portfolio."],
        ]}
      />
    </PageSection>
  ),

  /* ───────── 1 · Finding deals ───────── */
  profiles: (
    <PageSection
      id="profiles"
      kicker="Sourcing → Search profiles"
      title="Search profiles"
      lede="A saved description of what we want to buy and where. The engine runs every active profile on its schedule."
      blocks={[
        { title: "What you set", items: [<><b>Industries</b> and keywords: HVAC, air conditioning, heating and cooling</>, <><b>City, state and radius</b>, plus how strict location must be</>, <><b>Sources:</b> Google Places, Brave Search, broker listing sites</>, <><b>Buy box:</b> revenue, profit, max asking price, signal words like “retiring”</>, <><b>Cap and frequency:</b> max new leads per run, how often it runs</>] },
        { title: "Key point", items: [<>A new industry or region is a form to fill in, <b>never new code</b>. <b>Run now</b> starts a search right away.</>] },
      ]}
      example={{ text: "“HVAC, Phoenix metro (brokers)”: 40-mile radius, weekly, up to 100 leads per run, revenue $1M–$5M, profit ≥ $250K, asking ≤ $3.5M, signals “retiring” and “owner selling”." }}
      notes={["Think of a profile as a standing purchase order for the engine: the industry, the region and the buy box.", "Opening a new industry or region (dental practices, commercial real estate…) is filling in this form. No programmer needed.", "Every run has a cap on new leads, and every paid call is logged (see Engine spend)."]}
    >
      <ProfilesMock />
    </PageSection>
  ),

  engine: (
    <PageSection
      id="engine"
      wide
      kicker="How the lead engine works"
      title="Four doors in, one review queue"
      lede="Whatever the source, every find goes through the same steps (dedupe, AI extraction, fit score) and lands in the same Review queue for a person to decide."
      notes={["Four doors: scheduled (broker sites + Google/Brave), email, by hand or shared from the phone, and an API.", "The engine respects robots.txt and captchas and never works around a block. A site that blocks it is flagged for a person to check.", "If the AI step fails, nothing is lost: the find is saved with its raw text and marked."]}
    >
      {grid(
        "sm:grid-cols-2 lg:grid-cols-4",
        <>
          <Pane kicker="Door 1 · Scheduled" title="Broker websites">About once a week it discovers brokers in the state, then opens each one’s “buy a business” pages the way a person would, following industry categories and next-page links.</Pane>
          <Pane kicker="Door 1 · Scheduled" title="Google Places & Brave">Finds operating companies in the area (name, address, phone, website), for owners we could approach before they list.</Pane>
          <Pane kicker="Door 2 · Email" title="Listing emails">Each workspace has its own inbox address. Broker digests sent there are read by AI: one email with 5 businesses becomes 5 leads.</Pane>
          <Pane kicker="Doors 3 & 4 · You" title="Paste, share, API">Paste a link or text, or tap Share → TAGR CRM on your phone. Scripts can use a secured API.</Pane>
        </>
      )}
      <Steps
        items={[
          ["DEDUPE", "Seen before? Skipped", "So it costs nothing. The same listing by email and on the site becomes one lead."],
          ["AI EXTRACTION", "Reads the fields", "Price, revenue, profit, employees, years, reason for selling, contact. Values kept exactly as written."],
          ["FIT + LOCATION", "Scored", "Against the profile’s buy box and area. Badges only, nothing is hidden."],
          ["REVIEW", "A person decides", "Add to pipeline, or dismiss. Dismissed finds never come back."],
        ]}
      />
    </PageSection>
  ),

  review: (
    <PageSection
      id="review"
      kicker="CRM → Sourcing → Review"
      title="Review"
      lede="The queue for everything the engine, an email or a teammate brought in. Nothing here is in the pipeline yet. A person decides."
      blocks={[
        { title: "What you do here", items: [<><b>Open</b> a find: details, source, original link</>, <><b>Add to pipeline:</b> it becomes a card on the Leads board, with contact and organization created for you</>, <><b>Dismiss:</b> archived as history; the engine won’t bring it back</>, <><b>Sort</b> by best fit and filter by when it was found</>] },
        { title: "The two badges", items: [<><b>Fit:</b> Match / Partial / Miss / Unknown, measured against the buy box</>, <><b>Location:</b> In area / Region / Same state / Location?</>] },
      ]}
      example={{ text: "The weekly HVAC run brought 21 new finds. Sort by fit, open the three Matches that mention “retiring”, add one to the pipeline and dismiss the franchise resale that’s over budget." }}
      hint="Try it: tap the Fit filters"
      notes={["Fit never hides anything. A “Miss” still shows up — sometimes the price is negotiable.", "The number on Sourcing in the sidebar is how many finds are still waiting for a decision."]}
    >
      <ReviewDemo />
    </PageSection>
  ),

  "lead-detail": (
    <PageSection
      id="lead-detail"
      kicker="Review → open a find"
      title="What the AI reads out of a listing"
      lede="Opening a find shows the fields the AI extracted, exactly as the source wrote them, and a line-by-line check against the buy box."
      blocks={[
        { title: "Extracted for every find", items: ["Business, industry, summary, location, website", "Asking price, revenue, profit, employees, years in business", "Reason for selling and signals (“retiring”, “owner selling”)", "Seller or broker contact: name, email, phone"] },
        { title: "Safety", items: [<>The AI is told <b>not to guess or convert</b>. Links are only trusted if they literally appear in the source.</>] },
      ]}
      example={{ text: <>One click on <b>Add to pipeline</b> turns this listing into a card in Sourced, creates the broker as a contact, and keeps a link back to the original listing.</> }}
      notes={["The Fit rule: any failed check = Miss; all checks passed = Match; some unknown = Partial.", "The AI never invents numbers: if the listing doesn’t state revenue, the field stays empty and the check is “Unknown”."]}
    >
      <LeadDetailMock />
    </PageSection>
  ),

  "add-lead": (
    <PageSection
      id="add-lead"
      kicker="Review → Add lead · Phone share"
      title="Found something yourself? Paste it, or share it from your phone."
      lede="The same AI reads anything you bring in. One box takes a link or raw text."
      blocks={[
        { title: "Three ways in", items: [<><b>Add lead:</b> paste a listing link (the CRM fetches and reads the page) or paste the text</>, <><b>Share from phone:</b> with the CRM installed, tap Share → TAGR CRM on any page (Android)</>, <><b>API:</b> a secured endpoint for scripts, rate-limited</>] },
        { title: "Good to know", items: ["If a site blocks robots, the find is still saved with its link, and you’re asked to paste the text.", "Submitting the same link twice costs nothing: it’s recognized as a duplicate."] },
      ]}
      example={{ text: "“Phoenix Pool Service Route”: spotted in a Facebook group, shared from the phone with the note “Saw this on a Facebook group.” It shows up in Review already read and scored." }}
      notes={["Anyone on the team can feed the funnel from their phone in seconds.", "The CRM installs on a phone like an app (Settings → Application); that’s why it appears in the phone’s Share menu."]}
    >
      <AddLeadMock />
    </PageSection>
  ),

  "listing-sites": (
    <PageSection
      id="listing-sites"
      kicker="Sourcing → Listing sites"
      title="Listing sites"
      lede="The business brokers whose websites the engine reads. It finds most of them on its own, about once a week, from our industries and state."
      blocks={[
        { title: "What you can do", items: [<><b>Add site:</b> a broker the engine missed, optionally with its listings page</>, <><b>Ignore</b> a site: never read or re-added again</>, <><b>Click a status</b> for a plain-English explanation of what happened</>] },
        { title: "Polite by design", items: [<>Respects robots.txt and “are you human?” checks. It <b>never works around them</b>. Those sites are flagged for a person, or moved to Email sources.</>] },
      ]}
      example={{ text: "“Grand Canyon Business Sales” asks robots to stay out, so it shows in red. We open it by hand once a week and sign up for its listing emails instead." }}
      notes={["The engine discovers brokers by itself and reads their “businesses for sale” pages.", "It never forces its way past a block, which protects Tagr’s reputation with brokers.", "Pages that haven’t changed since the last read aren’t sent to the AI again, which keeps costs low."]}
    >
      <ListingSitesMock />
    </PageSection>
  ),

  "email-sources": (
    <PageSection
      id="email-sources"
      kicker="Sourcing → Email sources"
      title="Email sources"
      lede="Some brokers never let a program read their site, but they’ll email new listings. This page tracks which of those lists our inbox address is subscribed to."
      blocks={[{ title: "How it works", items: [<>Each workspace has its <b>own inbox address</b>. Sign the broker’s list up with it.</>, <>Simple forms (no captcha) can be <b>filled in by the engine</b>, with our name, phone and company</>, <>When the “confirm your subscription” email arrives, the CRM <b>clicks the link for us</b> and marks it subscribed</>, <>Captcha, NDA or account required → flagged to do by hand, then <b>Mark subscribed</b></>] }]}
      example={{ text: "Sun Valley Mergers: the engine submitted the form yesterday and is waiting for the confirmation. Southwest Biz Advisors needs an NDA first, so their advisor offered to add us by hand." }}
      notes={["Two complementary paths: read the broker’s site (Listing sites), or receive its emails (Email sources).", "The CRM even confirms subscriptions on its own, but conservatively: when in doubt, it doesn’t click."]}
    >
      <EmailSourcesMock />
    </PageSection>
  ),

  emails: (
    <PageSection
      id="emails"
      kicker="Sourcing → Emails"
      title="Emails: everything that arrived, and what the AI found in it"
      lede="The record of the email door. Click one to read it beside the list. Each business found in an email also becomes its own find in Review."
      blocks={[
        { title: "The results", items: [<><b>N listings:</b> businesses for sale were found. Each one is a find in Review.</>, <><b>No listing found:</b> read, but nothing for sale (a welcome or promo). Kept as one find.</>, <><b>Couldn’t be read:</b> read it here and add any business by hand</>] },
        { title: "Easy to read", items: ["Long tracking links show as a short chip with the site’s name. Forward any listing email to the workspace address and it’s read the same way."] },
      ]}
      example={{ text: "The Pinnacle weekly digest lists 4 businesses. It arrives as one email and becomes 4 separate finds, each with its own listing link." }}
      hint="Try it: tap an email"
      notes={["One email listing several businesses becomes several finds, each with its own link. The AI can only keep a link that literally appears in the email — it can’t invent one."]}
    >
      <EmailsDemo />
    </PageSection>
  ),

  spend: (
    <PageSection
      id="spend"
      kicker="Settings → Engine spend"
      title="Engine spend: what the automation costs"
      lede="Every paid call (Google, Brave, the AI, email) is logged the moment it happens and added up per service and per run."
      blocks={[
        { title: "Use it to decide", items: [<>Which profiles are <b>worth their cost</b></>, <>How many leads per run make sense (<b>lower the cap</b> or the frequency)</>, "Spot a failing run (e.g. a Google quota hit) the same day"] },
        { title: "Good to know", items: [<>Figures are <b>estimates from public list prices</b>, not invoices. Good for comparing, not for reconciling.</>] },
      ]}
      example={{ tag: "Demo workspace, 3 weeks", text: <><b>83 leads added for under $1</b> in API calls, about 1¢ per lead. The AI reading step is the cheapest part.</> }}
      notes={["The numbers come from the demo workspace, but the order of magnitude is real: cents per lead.", "The biggest cost is Google Places, not the AI."]}
    >
      <SpendMock />
    </PageSection>
  ),

  /* ───────── 2 · Working deals ───────── */
  leads: (
    <PageSection
      id="leads"
      kicker="CRM → Leads"
      title="Leads: the deal pipeline"
      lede="Every lead we decided to pursue, stage by stage. Move a card as the conversation with the seller advances."
      blocks={[{ title: "What you can do", items: [<><b>Drag</b> cards between stages, or switch to the list view to sort</>, <><b>Open</b> a card: notes, contact, organization, activities</>, <><b>Create</b> a lead directly, without going through Sourcing</>, "The page fits the screen: each stage scrolls on its own"] }]}
      example={{ text: "Desert Breeze: offer at 3.1× SDE, waiting for the counter. Cool Air: LOI signed and in Diligence, financed through our SBA lender." }}
      hint="Try it: tap a card, then tap a stage"
      notes={["Stages: Sourced → Outreach → In Discussion → Offer Submitted → Diligence → Closed.", "The “4/8” on a card means 4 of its 8 activities are done.", "A list view is one click away, better for sorting many leads at once; it’s paged to fit the screen."]}
    >
      <LeadsBoardDemo />
    </PageSection>
  ),

  projects: (
    <PageSection
      id="projects"
      kicker="CRM → Projects"
      title="Projects: a board for everything else"
      lede="The Leads board is for deal flow. Projects are our own boards, each with its own stages: diligence checklists, integrations, partnerships, financing, internal initiatives."
      blocks={[{ title: "What you can do", items: [<><b>Create a board</b> and name its stages; rename, reorder or archive any time</>, "Cards work like Leads: contacts, organizations, activities", "One tab per board; board or list view"] }]}
      example={{ text: "“Due diligence, Cool Air Mechanical”: the QoE review is with the CPA, the lease review is with counsel, and the license list is waiting on seller." }}
      notes={["Projects fit any flow: due diligence, post-close integration (Day 1 / 30 / 90), financing, partnerships, marketing.", "Each card can have a contact and activities, so the history stays complete."]}
    >
      <ProjectsMock />
    </PageSection>
  ),

  activities: (
    <PageSection
      id="activities"
      kicker="CRM → Activities"
      title="Activities: one to-do list for everything"
      lede="Calls, meetings, emails, tasks and follow-ups, planned or done, each linked to the lead, project, Rock, contact or organization it’s about."
      blocks={[{ title: "What you can do", items: [<><b>Week board</b> (a column per day) or a <b>list</b> filtered by Overdue / Today / Next 7 days / Done</>, <><b>Only mine</b> shows just what’s assigned to you; the list opens on <b>Today</b></>, <><b>Assign</b> it to a teammate: they get a <b>push on their phone right away</b></>, <><b>Enable notification</b>: a reminder when it comes due</>, "Tick it off; L10 To-Dos and Rock milestones live here too"] }]}
      example={{ text: "Monday morning: two overdue items in red, then today’s LOI review with counsel, with a reminder on. Assigning “Site visit” to a teammate sends it straight to their phone." }}
      hint="Try it: tick an activity off"
      notes={["The bell 🔔 means a push reminder at the due time. Reminders are checked every 20 minutes, so one can arrive up to 20 minutes late.", "The ◆ line is linked to a Rock: it’s one of that Rock’s milestones (see Rocks).", "On a computer the list is paged to fit the screen, and each day of the week board scrolls on its own. On a phone each day is nearly a screen wide."]}
    >
      <ActivitiesDemo />
    </PageSection>
  ),

  contacts: (
    <PageSection
      id="contacts"
      kicker="CRM → Contacts"
      title="Contacts, organizations and our own team"
      lede="The sellers, brokers, lenders and advisors we deal with, and the companies they belong to."
      blocks={[
        { title: "Three tabs", items: [<><b>People:</b> sellers, brokers, advisors</>, <><b>Organizations:</b> the companies, with website and notes</>, <><b>Team:</b> our own people who can own a Rock, a number or a task, with or without a login</>] },
        { title: "Automatic", items: ["Adding a find to the pipeline creates its contact and organization for you."] },
      ]}
      example={{ text: "Before a call with Pinnacle, search “Rachel”: she’s on the broker outreach project, she introduced Tempe Appliance Repair, and there’s a follow-up due tomorrow." }}
      notes={["The Team tab is where a company’s own people live — they can own Rocks, numbers and tasks even before they have a login. When they accept an invite with the same email, their login links itself."]}
    >
      <ContactsMock />
    </PageSection>
  ),

  "contact-detail": (
    <PageSection
      id="contact-detail"
      kicker="Contacts → open a person"
      title="One person’s whole history, before you call"
      lede="Every lead, project card and activity this person is part of. They’re the real records, not copies: change them here and it changes everywhere."
      blocks={[{ title: "What you can do", items: ["Tap the email or phone to write or call", "Edit details; pick or create their organization", "Open a lead, card or activity in the same panel: move it, tick it, edit it"] }]}
      example={{ text: "Dale Hutchins, the owner of Cool Air: the deal is in Diligence, he’s on the QoE review card, the QoE call is overdue, and the shop visit is in 2 days." }}
      notes={["The page to open two minutes before a call: everything about the person in one place."]}
    >
      <ContactDetailMock />
    </PageSection>
  ),

  /* ───────── 3 · Traction ───────── */
  overview: (
    <PageSection
      id="overview"
      kicker="Traction → Overview"
      title="This week, on one screen"
      lede="Where the company stands right now, when the next L10 is, and where EOS is being used against its own rules."
      blocks={[{ title: "How the pieces connect", items: [<>A <b>Scorecard</b> number misses its goal → it turns red</>, <>A <b>Rock</b> slips → it’s marked off track</>, <>Either one goes to <b>Issues</b> in one click</>, <>The <b>L10</b> solves the top three issues</>, <>Each solution becomes a 7-day <b>To-Do</b> in Activities</>] }]}
      example={{ tag: "Real data · Grounded", text: "The checks catch what the spreadsheet couldn’t: the Scorecard has no owners (“Who” was empty), only 1 of 7 numbers has a goal, and the V/TO has no core values yet." }}
      notes={["Grounded’s numbers here are real (from its spreadsheet). The “EOS checks” show the value of the system: it points out what’s missing to run EOS properly.", "Every tile opens its own page."]}
    >
      <OverviewMock />
    </PageSection>
  ),

  scorecard: (
    <PageSection
      id="scorecard"
      kicker="Traction → Scorecard"
      title="Scorecard"
      lede="The handful of numbers that say how the company is doing. Each has one owner and one goal; cells turn green or red on their own."
      blocks={[{ title: "What you can do", items: [<><b>Type a number</b> in a cell; weekly or monthly</>, <>Red cell → <b>Drop to Issues</b> so the L10 deals with it</>, "Goal as at least / at most / exactly / a range", <><b>Portfolio standard numbers:</b> the same measurables in every company, so they compare</>] }]}
      example={{ tag: "Real data · Grounded", text: "Revenue grew from $14.7K in May to $27.9K in August, always above the $13.5K goal. Active customers went 301 → 421." }}
      hint="Try it: type 12000 in September’s revenue"
      notes={["Type a number in September’s revenue: below 13,500 turns red, above turns green.", "“Call backs ≤ 5” is an example goal added to demonstrate the “at most” rule; Grounded’s spreadsheet didn’t have it.", "Standard numbers let the owner compare every company in the portfolio side by side."]}
    >
      <ScorecardDemo />
    </PageSection>
  ),

  rocks: (
    <PageSection
      id="rocks"
      kicker="Traction → Rocks"
      title="Rocks: 90-day priorities"
      lede="What must get done this quarter, each with one owner, a due date and a finish line anyone could check. EOS recommends 3 to 7."
      blocks={[{ title: "What you can do", items: [<>Change status: <b>on track, off track, complete, dropped</b> — or switch to the <b>board</b> and drag it</>, <>Break a Rock into <b>milestones &amp; to-dos</b>; they show in Activities and the Rock counts how many are done</>, <>Off track → <b>drop to Issues</b> for the L10</>, <>At quarter end: complete, <b>carry over</b>, or drop each unfinished Rock</>] }]}
      example={{ tag: "Real data · Grounded, Q2 2026", text: "Two Rocks complete (3rd truck; 5 apartment complexes), two off track (July $50K; 500 customers by July). Completion is 50% against an 80% target." }}
      hint="Try it: tap a status"
      notes={["The Rocks are Grounded’s real Q2 Rocks. The to-do counts are illustrations.", "“Done is binary”: a Rock is done or it isn’t. The EOS target is 80% of Rocks complete."]}
    >
      <RocksDemo />
    </PageSection>
  ),

  issues: (
    <PageSection
      id="issues"
      kicker="Traction → Issues"
      title="Issues: everything in the way, ranked"
      lede="Problems, ideas and obstacles in one ranked list. The weekly L10 works the top three, one at a time, with IDS."
      blocks={[
        { title: "IDS", items: [<><b>Identify:</b> the real issue in one sentence, the root cause and not the symptom</>, <><b>Discuss:</b> everyone weighs in, no tangents, 5–15 minutes</>, <><b>Solve:</b> a decision plus To-Dos, each with one owner and a due date — the owner gets a push</>] },
        { title: "Two lists", items: [<><b>This week (L10)</b> vs <b>Long term (V/TO)</b>, worked at the quarterly. Issues open 4+ weeks turn red.</>] },
      ]}
      example={{ tag: "Real data · Grounded", text: "The IDS list from the spreadsheet: 3 open, 2 solved (“Next quarterly?”, “Find more home inspectors”)." }}
      hint="Try it: tick an issue solved"
      notes={["The list is Grounded’s real one. The “Solve” panel is an illustration of how IDS gets filled in.", "The To-Dos it creates land in Activities and in the next L10, and each owner gets a push right away."]}
    >
      <IssuesDemo />
    </PageSection>
  ),

  l10: (
    <PageSection
      id="l10"
      kicker="Traction → L10 Meeting"
      title="The L10, run from the CRM"
      lede="The weekly 90-minute leadership meeting, step by step, with live data and a timer per step. Nothing is copied by hand."
      blocks={[{ title: "How it runs", items: [<>Same day and time; <b>reminder 1 h before</b> by push and email, with the meeting’s points</>, <><b>Start meeting:</b> it opens for everyone on their own device</>, "Each step shows real Scorecard, Rocks, To-Dos and Issues; changes save instantly", <>Everyone <b>rates it 1–10</b> from their phone; under 8, it asks what would make it a 10</>] }]}
      example={{ tag: "Try it", text: "Pick a step on the agenda and press Start: the clock is real, and it turns red when a step runs over, so the meeting ends on time." }}
      notes={["The standard EOS agenda: Segue 5, Scorecard 5, Rocks 5, Headlines 5, To-Dos 5, IDS 60, Conclude 5 = 90 minutes.", "The ratings and segues are illustrations; the Scorecard, Rocks, To-Dos and Issues are Grounded’s."]}
    >
      <L10Demo />
    </PageSection>
  ),

  history: (
    <PageSection
      id="history"
      kicker="Traction → L10 → History"
      title="Meeting history: the trend, not just the week"
      lede="Concluding an L10 saves a snapshot: the average rating and each person’s, the headlines, and that week’s numbers."
      blocks={[
        { title: "What to look for", items: ["Ratings dropping week over week", "To-Dos staying under 90%", "The same Rocks off track again and again"] },
        { title: "Who sees it", items: [<>The team, here, and the owner in the <b>Portfolio</b>, without attending the meeting.</>] },
      ]}
      example={{ tag: "Illustration", text: "Three weeks of a company improving: To-Dos from 62% to 91%, rating from 7.4 to 8.6." }}
      notes={["These cards are illustrations: Grounded doesn’t have L10 history in the system yet.", "The value: the owner follows the health of each company’s meeting without attending it."]}
    >
      <HistoryMock />
    </PageSection>
  ),

  /* ───────── 4 · EOS foundations ───────── */
  setup: (
    <PageSection
      id="setup"
      kicker="EOS → Vision · first visit"
      title="A blank V/TO walks you through it"
      lede="The first time a company opens Vision, it becomes a six-step guided setup, so an admin can build the plan one piece at a time."
      blocks={[{ title: "The six steps", items: ["Core values → Core focus → 10-year target", "Marketing strategy → 3-year picture → 1-year plan", "Each with what it is and a concrete example", <><b>Saves as you go</b>; “Finish later” keeps your place, and a banner picks up where you stopped</>] }]}
      example={{ tag: "Try it", text: "Tap the steps in the mock to move through them." }}
      notes={["This is how the Vision page looks on a company’s first visit: the steps on the left, the fields on the right, and a Save & continue at the bottom."]}
    >
      <SetupDemo />
    </PageSection>
  ),

  vto: (
    <PageSection
      id="vto"
      kicker="EOS → Vision"
      title="The V/TO on one page"
      lede="Where the company is going (vision) and how it gets there (traction), shared with the whole company."
      blocks={[
        { title: "What it holds", items: ["Core values, core focus, 10-year target, marketing strategy", "3-year picture, 1-year plan, this quarter’s Rocks", <>Long-term issues, <b>live</b> from their own pages</>, <>Each 1-year goal shows how many Rocks move it; <b>none = red</b></>] },
        { title: "By design", items: ["Blank parts show as dashed gaps: work still to do."] },
      ]}
      example={{ tag: "Real data · Grounded", text: "“Grounded In Trust”. $20M and 60–70 techs across multiple markets by 2036; $3M and 8–10 trucks by 2029; $600K, 4–5 trucks and a Conex by Jan 2027." }}
      notes={["Real data from Grounded’s V/TO. The dashed gaps are what the spreadsheet left blank: the system shows what’s missing.", "“0 Rocks” in red: no priority this quarter is tied to those yearly goals."]}
    >
      <VtoMock />
    </PageSection>
  ),

  people: (
    <PageSection
      id="people"
      kicker="EOS → People"
      title="Right people, right seats"
      lede="The Accountability Chart shows who sits where; the People Analyzer reviews whether each person fits."
      blocks={[
        { title: "Accountability Chart", items: [<>Seats with 3–5 roles each; <b>one person per seat</b></>, "An empty seat is outlined in red", "Who sits above whom decides who reviews whom"] },
        { title: "People Analyzer (private)", items: [<><b>Right person:</b> + / +− / − on each core value</>, <><b>Right seat:</b> Gets it, Wants it, Capacity to do it (GWC)</>, "You see your own and your direct reports’ reviews"] },
      ]}
      example={{ tag: "Illustration", text: "An example chart for a service company: the Visionary and Integrator on top, then a seat per function, with an empty Finance seat to hire for." }}
      notes={["An illustration, not real people. Each company builds its own chart.", "The People Analyzer is private: each person sees their own reviews and their direct reports’; admins see everyone’s."]}
    >
      <PeopleMock />
    </PageSection>
  ),

  process: (
    <PageSection
      id="process"
      kicker="EOS → Process"
      title="Core processes"
      lede="The 20% of processes that give 80% of the consistency, so the company runs the same way every time."
      blocks={[{ title: "What you can do", items: [<>Document each one with an owner and <b>5–20 major steps</b></>, <>Move it from <b>documented → trained → followed by all</b> (FBA)</>, <>Review quarterly; one not reviewed in 90 days is <b>flagged</b></>] }]}
      example={{ tag: "Real data + illustration", text: <>Grounded’s V/TO names <b>Onboarding</b> as its proven process — the natural first one to document. The others are examples of the usual set.</> }}
      notes={["Only “Onboarding” comes from Grounded’s real spreadsheet; the other processes and the steps are examples."]}
    >
      <ProcessMock />
    </PageSection>
  ),

  checkup: (
    <PageSection
      id="checkup"
      kicker="EOS → Checkup"
      title="Organizational Checkup"
      lede="The leadership team scores the company on the 20 EOS statements, 1 (weak) to 5 (strong). The total is a 0–100% score, saved to measure movement."
      blocks={[
        { title: "When", items: [<>At kickoff (the baseline), and again later — the playbook asks for <b>month 12</b></>] },
        { title: "Reading the score", items: [<><b>Under 40%:</b> needs focus</>, <><b>40–69%:</b> building the foundation</>, <><b>70%+:</b> strong and scalable</>] },
      ]}
      example={{ tag: "Live tool", text: "These are the real 20 statements. Score them here: the total and band update as you tap, just like in the app." }}
      hint="Try it: change any score"
      notes={["The 20 statements are the official EOS ones, the same as in the app. The “kickoff 48%” is an example baseline."]}
    >
      <CheckupDemo />
    </PageSection>
  ),

  /* ───────── 5 · The owner's view ───────── */
  portfolio: (
    <PageSection
      id="portfolio"
      kicker="Platform → Portfolio"
      title="Portfolio: every company’s Traction at a glance"
      lede="How the owner follows every company without attending any L10. Each row is fed live by that company’s Scorecard, Rocks, Issues, To-Dos, last L10 and Checkup."
      blocks={[{ title: "Reading it", items: [<>To-Dos <b className="text-green-800 dark:text-green-400">green at 90%+</b>, <b className="text-destructive">red under 70%</b></>, "Checkup: kickoff → latest, with the movement in points", <><b>Standard numbers:</b> the same measurables in every company, side by side</>, "Click a company to open its Overview"] }]}
      example={{ tag: "Real data · Grounded row", text: "The Grounded row is real: revenue on goal, Rocks 2/4 with 2 off, 3 open issues, To-Dos at 24%. The other rows show how more companies would appear." }}
      notes={["Only the Grounded row is real; the others are marked “example”.", "The owner doesn’t need to open each company — the consolidated view shows where to act.", "Each row is read through that company’s own data security; nothing ever mixes companies in one query."]}
    >
      <PortfolioMock />
    </PageSection>
  ),

  workspaces: (
    <PageSection
      id="workspaces"
      kicker="Platform → Workspaces"
      title="One workspace per company"
      lede="Each workspace is a separate company: its own people, data, pipeline, Traction and inbox address. One person can belong to several and switch from the account menu."
      blocks={[
        { title: "What the platform admin does", items: [<><b>Create</b> a workspace and invite its first admin by email</>, "Rename, archive, manage members", "Jump into any workspace; open the Portfolio"] },
        { title: "Built for growth", items: ["Ready for the Menlo Group units (CRE, Dental Transitions, Business Brokerage) and every new acquisition, with no code changes."] },
      ]}
      example={{ tag: "Today", text: <>Two workspaces are live: <b>TAGR Holdings</b> and <b>Grounded Pest Control</b> (its EOS spreadsheet imported). Grounded’s team sees only Grounded; the owner sees everything.</> }}
      notes={["Multi-company from day one: each workspace has its own inbox address for listing emails."]}
    >
      <WorkspacesMock />
    </PageSection>
  ),

  portal: (
    <PageSection
      id="portal"
      kicker="Outside the app → Partner Portal"
      title="The Partner Portal: our Operating Playbook"
      lede="A confidential page for founders, operators and partners: how we build, scale and operate companies in the TAGR ecosystem."
      blocks={[
        { title: "What’s in it", items: [<><b>Playbook:</b> methodologies, SOPs &amp; tools, governance, cadence, growth</>, <><b>Tools:</b> the EOS Checkup and an <b>Urgency Index</b>, scored live</>, "The frameworks we build on: EOS, Five Dysfunctions, StoryBrand, Gallup Q12, Who (Topgrading)"] },
        { title: "Access", items: [<>Visitors request access with name and email and get in <b>instantly</b>, through a secure link. No account needed.</>] },
      ]}
      example={{ tag: "How we use it", text: "Before a first call with a seller, send the Portal link: they see how we operate and can take the EOS Checkup themselves, so the conversation starts from data." }}
      notes={["The Portal is public but gated: a visitor asks for access and gets in right away through a link with a secure token.", "Good for relationships with sellers and partners: it shows how seriously we run companies."]}
    >
      <PortalMock />
    </PageSection>
  ),

  you: (
    <PageSection
      id="you"
      wide
      kicker="Profile · Settings · Notifications"
      title="You, your team, and an app on every device"
      lede="Invitation-only, with clear roles, installable on phone and desktop, and help built into every page."
      notes={["Built-in help means much less training when someone new — or a new portfolio company — joins.", "On an iPhone, push notifications only work with the CRM installed on the Home Screen."]}
    >
      {grid(
        "sm:grid-cols-2 lg:grid-cols-4",
        <>
          <Pane kicker="Your profile" title="Name & email"><ul className="space-y-1"><li>Account menu → <b className="text-foreground">Profile</b></li><li>Change your display name; it updates you on every team</li><li>Change your sign-in email with a 6-digit code sent from TAGR Holdings</li><li>See your role and title in each workspace</li></ul></Pane>
          <Pane kicker="Invites & roles" title="Who can do what"><ul className="space-y-1"><li><b className="text-foreground">No public sign-up:</b> one-time invite links</li><li><b className="text-foreground">Member:</b> CRM and Traction</li><li><b className="text-foreground">Admin:</b> plus invites, roles, engine spend, the L10 schedule</li><li><b className="text-foreground">Platform admin:</b> every workspace, Portfolio</li></ul></Pane>
          <Pane kicker="Notifications" title="On your phone"><ul className="space-y-1"><li>A task assigned to you, <b className="text-foreground">right away</b></li><li>Reminders for tasks with a due time</li><li>The L10 one hour before (push + email)</li><li>Turn it on per device in Settings</li></ul></Pane>
          <Pane kicker="The app" title="Phone and desktop"><ul className="space-y-1"><li><b className="text-foreground">Install</b> it: its own window, same data</li><li><b className="text-foreground">Share → TAGR CRM</b> from the phone</li><li>Pages fit the screen; lists are paged</li><li>Bottom bar on the phone: CRM → Traction → EOS</li></ul></Pane>
        </>
      )}
      <Pane kicker="Built-in help">
        Every page has a <b className="text-foreground">(?)</b> button: what the page is for, plus a <b className="text-foreground">guided tour</b> that highlights each control. The full guide lives in <b className="text-foreground">Documentation</b> (account menu). A test fails the build if any page is missing its help, so it never goes stale.
      </Pane>
    </PageSection>
  ),

  security: (
    <PageSection
      id="security"
      wide
      kicker="Security & trust"
      title="Each company’s data stays with that company"
      lede="Isolation is enforced by the database itself, not just by the screens. That matters as more companies join."
      notes={["In business terms: even if a screen had a bug, the database itself won’t let one company see another’s data.", "That’s what makes it safe to put different companies (Tagr, Grounded, Menlo) on the same platform."]}
    >
      {grid(
        "sm:grid-cols-2 lg:grid-cols-3",
        <>
          <Pane title="Isolation at the database">Every record belongs to one workspace, and the database blocks reading another company’s rows even if a screen had a bug. Every request re-checks access.</Pane>
          <Pane title="Least privilege for the engine">The lead engine connects with its own restricted role: it can add finds, never read contacts or deals, never delete, never cross companies.</Pane>
          <Pane title="Errors never leak">Users see clear, friendly messages; internal database errors never reach the browser.</Pane>
          <Pane title="Invitation-only access">No public sign-up. One-time invite links that expire. Roles per workspace.</Pane>
          <Pane title="Untrusted input stays untrusted">Scraped and AI-written data is treated as untrusted: links validated, signed webhooks verified, the API rate-limited.</Pane>
          <Pane title="Polite, legal sourcing">robots.txt and captchas are respected, never bypassed. Costs are logged per call, and runs are capped.</Pane>
        </>
      )}
    </PageSection>
  ),

  status: (
    <PageSection
      id="status"
      wide
      kicker="Where we are"
      title="Live today, and what comes next"
      lede="What’s running in production now, and the decisions that move things forward."
      notes={["Decisions that move things forward: who owns each Grounded number, when to run the first L10 in the system, and which company joins next."]}
    >
      {grid(
        "md:grid-cols-2",
        <>
          <Pane kicker="Live in production">
            <ul className="space-y-1.5">
              <li>CRM: Sourcing, Leads, Projects, Activities, Contacts, Team</li>
              <li>Traction: Scorecard, Rocks (with milestones and a board), Issues, L10 with live ratings and reminders, history</li>
              <li>EOS: V/TO with guided setup, People, Processes, Checkup</li>
              <li>Portfolio with standard numbers across companies</li>
              <li>Push notifications, profile, invites, roles, installable app</li>
              <li>Tagr’s deals, activities and contacts imported from Pipedrive</li>
            </ul>
          </Pane>
          <Pane kicker="Next steps">
            <ul className="space-y-1.5">
              <li><b className="text-foreground">Bring the team in:</b> invites out; logins link to the team automatically</li>
              <li><b className="text-foreground">Grounded:</b> an owner and a goal on every measurable, Q4 Rocks, the first L10 in the app</li>
              <li><b className="text-foreground">Kickoff Checkup</b> per company, to set the baseline</li>
              <li><b className="text-foreground">Lead engine:</b> finish its production setup and turn on the first search profiles</li>
              <li><b className="text-foreground">Next companies</b> as workspaces (Menlo units, new acquisitions)</li>
            </ul>
          </Pane>
        </>
      )}
      <p className="text-center"><Badge tone="y">Find. Close. Operate.</Badge></p>
    </PageSection>
  ),
};
