/**
 * The text behind the (?) button in the header: one entry per page, in plain words for someone new to the CRM.
 * Matching is by the longest route prefix, so /contacts/123 uses the /contacts entry and a page without an entry
 * simply shows no help button. Kept as data (not JSX) so it is cheap to edit and to test.
 */
export interface PageHelpSection {
  heading: string;
  /** One paragraph (string) or a bulleted list (array). */
  body: string | string[];
}

export interface PageHelp {
  title: string;
  /** One sentence: what this page is. */
  summary: string;
  sections: PageHelpSection[];
}

interface HelpContext {
  /** The dedicated leads inbox address (INBOUND_LEADS_ADDRESS), when configured. */
  inboxAddress: string | null;
}

interface Entry {
  path: string;
  build: (ctx: HelpContext) => PageHelp;
}

const ENTRIES: Entry[] = [
  {
    path: "/leads-inbox",
    build: () => ({
      title: "Leads Inbox",
      summary: "The review queue for everything the lead engine found: businesses for sale, and businesses in your area.",
      sections: [
        {
          heading: "What it's for",
          body: "Nothing here is in your pipeline yet. You look at what the engine (or an email, or you) brought in and decide what deserves attention.",
        },
        {
          heading: "What you can do",
          body: [
            "Open a lead to read its details, the source and the original link.",
            "Add to pipeline: promotes it to the Leads board so you can work it.",
            "Dismiss: archives it. It stays as history and the engine won't bring it back.",
            "Add lead: paste a link or text you found yourself, or share it from your phone.",
          ],
        },
        {
          heading: "The badges",
          body: [
            "Fit (Match / Partial / Miss / Unknown): how the lead lines up with the requirements of its search profile (price, revenue, …). It never hides a lead.",
            "Location (In area / Region / Same state / Location?): where a listing sits relative to the profile's city and radius.",
          ],
        },
      ],
    }),
  },
  {
    path: "/leads-inbox/profiles",
    build: () => ({
      title: "Search profiles",
      summary: "A saved description of what to look for and where. The engine runs each active profile on a schedule.",
      sections: [
        {
          heading: "What it's for",
          body: "A profile says which industries you want to buy, in which city and radius, and which sources the engine may use. Adding a new industry or region is filling out a profile — never new code.",
        },
        {
          heading: "What you can do",
          body: [
            "Create a profile: industries, city and state, radius, and how strictly listings must be near the city.",
            "Choose the sources: Google Places, Brave Search, Broker listing sites and more.",
            "Set requirements (revenue, profit, price, keywords like “retiring”): they only mark leads with a fit badge, they never delete one.",
            "Run now: starts a run right away instead of waiting for the schedule.",
          ],
        },
        {
          heading: "Keep in mind",
          body: "Each run has a cap on new leads, and every paid call is logged under Settings → Engine spend.",
        },
      ],
    }),
  },
  {
    path: "/leads-inbox/listing-sites",
    build: () => ({
      title: "Listing sites",
      summary: "The business brokers whose websites the engine reads to find businesses that are for sale.",
      sections: [
        {
          heading: "What it's for",
          body: "The engine finds brokers on its own (about once a week, using the industries in your search profiles and the state). It then opens each broker's “buy a business” pages, the way you would by hand, and turns every business for sale into a lead.",
        },
        {
          heading: "What you can do",
          body: [
            "Add site: add a broker yourself, optionally with the direct link to its listings page.",
            "Ignore a site you don't want; the engine won't read or re-add it.",
            "Click a status to see what happened with a site and what you can do about it.",
          ],
        },
        {
          heading: "Sites that don't let the engine in",
          body: "Some sites turn away automatic visitors (they show an “are you human?” check, or ask robots to stay out). The engine never tries to get around that. The site is flagged so you can open it yourself — and if it has an email list for new listings, add it under Email sources so those emails reach the inbox.",
        },
      ],
    }),
  },
  {
    path: "/leads-inbox/email-sources",
    build: ({ inboxAddress }) => ({
      title: "Email sources",
      summary: "Listing sites that send their listings by email, and whether the leads inbox is subscribed to each one.",
      sections: [
        {
          heading: "What it's for",
          body: `Some sites only send their listings by email. List them here and point their signup at the leads inbox${
            inboxAddress ? ` (${inboxAddress})` : ""
          }: every email that arrives there is read automatically and becomes a lead. Read the results under Settings → Inbox.`,
        },
        {
          heading: "Signing up",
          body: "Signing up is a separate step from receiving. Where a site's form has no captcha, the engine can fill it in for you (give it the two selectors), including your name, phone and company when the form asks. Sites with a captcha, or that want an NDA, terms or an account, are flagged for you to do by hand.",
        },
        {
          heading: "Confirmation",
          body: "When the site sends its “confirm your subscription” email, the CRM clicks the link for you and marks the site as subscribed. If you signed up by hand, use Mark subscribed.",
        },
      ],
    }),
  },
  {
    path: "/leads",
    build: () => ({
      title: "Leads",
      summary: "The board where leads you decided to pursue are worked, stage by stage.",
      sections: [
        {
          heading: "What it's for",
          body: "Leads arrive here from the Leads Inbox when you choose Add to pipeline (or you create one directly). Each card moves across stages as the conversation with the seller advances.",
        },
        {
          heading: "What you can do",
          body: [
            "Drag a card to another stage, or use the list view.",
            "Open a card to add notes, contacts, organizations and activities.",
            "Filter and search to find a lead quickly.",
          ],
        },
      ],
    }),
  },
  {
    path: "/pipeline",
    build: () => ({
      title: "Projects",
      summary: "Your own boards for anything else you are working on, one tab per board.",
      sections: [
        {
          heading: "What it's for",
          body: "The Leads board is for deal flow. Projects are for everything different: a due-diligence checklist, an acquisition you already closed, an internal task list. Each board has its own stages.",
        },
        {
          heading: "What you can do",
          body: ["Create a board and choose its stages.", "Drag cards between stages.", "Attach contacts, organizations and activities to a card."],
        },
      ],
    }),
  },
  {
    path: "/activities",
    build: () => ({
      title: "Activities",
      summary: "The calls, meetings, emails and tasks you have planned or done.",
      sections: [
        {
          heading: "What it's for",
          body: "A single place to see what needs doing this week and to keep a history of what was done, linked to the leads, contacts and organizations it concerns.",
        },
        { heading: "What you can do", body: ["Create an activity and set who does it and when.", "Filter by Overdue, Today, Next 7 days or Done.", "Open one to see or edit what it is linked to."] },
      ],
    }),
  },
  {
    path: "/contacts",
    build: () => ({
      title: "Contacts",
      summary: "The people and organizations you deal with.",
      sections: [
        {
          heading: "What it's for",
          body: "Sellers, brokers and advisors live here, with the companies they belong to. Open a contact to see their history: the leads and activities linked to them.",
        },
        { heading: "What you can do", body: ["Switch between People and Organizations.", "Add or edit a contact or organization.", "Open one to see what is linked to it."] },
      ],
    }),
  },
  {
    path: "/settings/inbox",
    build: ({ inboxAddress }) => ({
      title: "Inbox",
      summary: "Every email the leads inbox received, and the businesses for sale the AI read out of each one.",
      sections: [
        {
          heading: "What it's for",
          body: `Every email sent to ${
            inboxAddress ?? "the leads inbox address"
          } shows up here. Each business found in an email also becomes a lead in the Leads Inbox. Emails from sites you signed up to (see Email sources) arrive on their own — you can also forward a listing email yourself.`,
        },
        {
          heading: "The results",
          body: [
            "N listings: the AI found businesses for sale in the email.",
            "No listing found: it was read, but it had no business for sale (a welcome message, a promotion). It is kept as one lead.",
            "Couldn't be read: the automatic reading failed; open it in the Leads Inbox.",
          ],
        },
        { heading: "If nothing arrives", body: "Check that the Resend webhook is registered and that the address above is the one you signed up with." },
      ],
    }),
  },
  {
    path: "/settings/notifications",
    build: () => ({
      title: "Notifications",
      summary: "Choose whether this device gets alerts from the CRM.",
      sections: [
        {
          heading: "What it's for",
          body: "Turn on push notifications so the CRM can warn you on this device — for example when a new lead arrives — even when the app is closed.",
        },
        { heading: "Good to know", body: "The setting is per device and browser. If you blocked notifications in the browser, you have to allow them there first." },
      ],
    }),
  },
  {
    path: "/settings/invites",
    build: () => ({
      title: "Invites",
      summary: "Give a teammate their own login to the CRM.",
      sections: [
        {
          heading: "What it's for",
          body: "The CRM is invitation-only. Enter someone's email and they receive a link to choose a password and create their account.",
        },
        {
          heading: "Good to know",
          body: ["The link works once and expires after a few days.", "You can resend an expired invite or revoke one you no longer want."],
        },
      ],
    }),
  },
  {
    path: "/settings/application",
    build: () => ({
      title: "Application",
      summary: "How the CRM behaves as an app on this device.",
      sections: [
        {
          heading: "What it's for",
          body: "Install the CRM on your phone or computer so it opens like a normal app, and update it when a new version is available.",
        },
      ],
    }),
  },
  {
    path: "/settings/engine-spend",
    build: () => ({
      title: "Engine spend",
      summary: "How much the lead engine has cost, per service and per run.",
      sections: [
        {
          heading: "What it's for",
          body: "Every paid call the engine makes (Google, Brave, the AI that reads pages and emails) is logged. This page adds them up so you always know what the automation costs.",
        },
        {
          heading: "Good to know",
          body: "The figures are estimates from public list prices, not invoiced amounts. Use them to compare profiles and to decide how many leads per run are worth it.",
        },
      ],
    }),
  },
  {
    path: "/docs",
    build: () => ({
      title: "How to use the CRM",
      summary: "The guide to the CRM, section by section.",
      sections: [{ heading: "What it's for", body: "Use the list on this page to jump to a topic. The (?) button on every other page explains that page in a few lines." }],
    }),
  },
];

/** Help for a route, or null when the page has none. Longest matching prefix wins. */
export function getPageHelp(pathname: string | null, ctx: HelpContext): PageHelp | null {
  if (!pathname) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  const entry = ENTRIES.filter((e) => path === e.path || path.startsWith(`${e.path}/`)).sort((a, b) => b.path.length - a.path.length)[0];
  return entry ? entry.build(ctx) : null;
}
