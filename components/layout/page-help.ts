/**
 * The text behind the (?) button in the header: one entry per page, in plain words for someone new to the CRM,
 * plus the guided tour ("Show me") that walks through that page's important parts.
 *
 * EVERY page under `app/(hub)` must have an entry here, with at least one tour step — `page-help.test.ts` fails the
 * build otherwise, and also checks that every `target` below exists as a `data-tour="…"` attribute in the code (and
 * that no `data-tour` is orphaned). When you add, rename or remove a page or one of its main controls, update this
 * file in the same change.
 *
 * Matching is by the longest route prefix, so /contacts/123 uses the /contacts entry. Routes are workspace-relative: the
 * `/w/<slug>` part of the URL is dropped first. Kept as data (not JSX) so it
 * is cheap to edit and to test.
 */
import { stripWorkspacePrefix } from "@/lib/workspace-path";

export interface PageHelpSection {
  heading: string;
  /** One paragraph (string) or a bulleted list (array). */
  body: string | string[];
}

export interface TourStep {
  /**
   * The `data-tour` attribute of the element to highlight. Empty/omitted = a centred card with no spotlight.
   * A step whose element isn't on the page right now (an empty table, a banner that isn't showing) is skipped at
   * runtime, so a tour still works on an empty page.
   */
  target?: string;
  title: string;
  text: string;
  /** Limits the step to one viewport — for controls that only exist there (the sidebar, the bottom nav). */
  only?: "desktop" | "mobile";
  /**
   * A small looping illustration shown above the step text, above the step's own words. Three kinds:
   *
   * - `"vault"`, for a step that points at a button opening a Vault: its inputs filling in and the button being
   *   pressed. `fields` are plain labels, not the vault's real field names — a schematic ("you'll fill something
   *   in here"), not a preview, so it never goes stale when the vault's actual fields change. `checkbox` is
   *   optional — only use it for a checkbox that's actually a meaningful decision in that vault (e.g. which
   *   sources to search), not every minor "optional" tickbox.
   * - `"board"` / `"table"`, for a step that points at a kanban board or a table: a made-up, populated version of
   *   it (fake columns/cards, or fake rows), so a brand-new workspace's empty page still shows what things look
   *   like once there's data in it. Same schematic spirit as `"vault"` — `columns` are plain labels, not real ones.
   *
   * A `"board"`/`"table"` step's own `target` should point at an element that stays on the page even when it's
   * empty (not just the populated one), or the step disappears exactly when this illustration would help most.
   */
  demo?: { kind: "vault"; fields: string[]; checkbox?: string; button: string } | { kind: "board"; columns: string[] } | { kind: "table"; columns: string[] };
}

export interface PageHelp {
  title: string;
  /** One sentence: what this page is. */
  summary: string;
  sections: PageHelpSection[];
  tour: TourStep[];
}

interface HelpContext {
  /** The dedicated leads inbox address (INBOUND_LEADS_ADDRESS), when configured. */
  inboxAddress: string | null;
}

interface Entry {
  path: string;
  build: (ctx: HelpContext) => PageHelp;
}

/** Closing step, shared by every tour: how to get back to this help. */
const HELP_AGAIN: TourStep = {
  target: "header-help",
  title: "Need this again?",
  text: "This button explains whatever page you are on, and starts this tour again. Nothing here changes your data.",
};

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
      tour: [
        {
          target: "nav-sidebar",
          only: "desktop",
          title: "Getting around",
          text: "Everything starts here: the Leads Inbox for new finds, Leads for deals you are working, and Settings at the bottom.",
        },
        {
          target: "nav-bottom",
          only: "mobile",
          title: "Getting around",
          text: "These icons switch between the main parts of the CRM: the inbox of new finds, the leads you are working, and more. Your avatar on the far right opens the account menu: settings, workspaces, dark mode and sign out.",
        },
        {
          target: "leads-inbox-tabs",
          title: "The lead engine's pages",
          text: "Inbox is this list. Search profiles says what to look for and where; Listing sites and Email sources are where the businesses for sale come from. On a phone, each page's add button sits right beside these tabs.",
        },
        {
          target: "leads-inbox-table",
          title: "What the engine found",
          text: "One row per business. The badges tell you how well it matches your requirements and whether it is really in your area — neither ever hides a lead.",
          demo: { kind: "table", columns: ["Business", "Location", "Fit"] },
        },
        {
          target: "leads-inbox-filters",
          title: "Narrowing the list",
          text: "Search by name or city, then use the Sort and Found buttons to show the best matches first or only what showed up recently. On a phone this toolbar scrolls sideways if it doesn't all fit.",
        },
        {
          target: "leads-inbox-add",
          title: "Something you found yourself",
          text: "Paste a link or some text and it is added as a lead, read by the AI like any other. On a phone this is the + button beside the tabs, and you can also share a page straight into the CRM.",
          demo: { kind: "vault", fields: ["Link or text of the listing"], button: "Add" },
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "profiles-create",
          title: "Start with a profile",
          text: "A profile is a saved search: the industries you want to buy, the city and radius, and how often to look. This is where you tell the engine what to do. On a phone it is the + button beside the tabs.",
          demo: { kind: "vault", fields: ["Category", "City", "Radius (miles)"], checkbox: "Broker listing sites", button: "Create profile" },
        },
        {
          target: "profiles-table",
          title: "Your profiles",
          text: "Each row shows the area, the sources it uses and when it last ran. Turn one off and the engine skips it without losing anything.",
          demo: { kind: "table", columns: ["Profile", "Area", "Status"] },
        },
        {
          target: "profiles-table",
          title: "Run now",
          text: "Each row has a Run now button that starts a search immediately instead of waiting for the schedule — handy right after you change a profile.",
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "listing-sites-table",
          title: "The brokers the engine reads",
          text: "The engine finds these on its own, then opens each one's “buy a business” page the way you would by hand.",
          demo: { kind: "table", columns: ["Site", "Status"] },
        },
        {
          target: "listing-sites-table",
          title: "What happened with each site",
          text: "The status says how the last visit went. Click it and a window explains, in plain words, what happened and what you can do about it.",
        },
        {
          target: "listing-sites-flagged",
          title: "Sites that need you",
          text: "These turn away automatic visitors. The engine never forces its way in, so open them yourself — or sign up for their listing emails under Email sources.",
        },
        {
          target: "listing-sites-add",
          title: "Add a broker yourself",
          text: "Know a broker the engine missed? Add its address here (on a phone, the + button beside the tabs). If you already know the page that lists the businesses, paste that too.",
          demo: { kind: "vault", fields: ["Website", "Name"], button: "Add site" },
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "email-sources-add",
          title: "Sites that deliver by email",
          text: "Some brokers never let a program read their site, but will happily email you new listings. Add those sites here (on a phone, the + button beside the tabs).",
          demo: { kind: "vault", fields: ["Site name", "Signup page URL"], button: "Add site" },
        },
        {
          target: "email-sources-table",
          title: "Who is subscribed",
          text: "Each row shows whether the inbox is signed up yet. Where the form is simple, the engine can fill it in for you; otherwise it asks you to do it by hand.",
          demo: { kind: "table", columns: ["Site", "Subscribed"] },
        },
        {
          target: "email-sources-flagged",
          title: "Sign-ups that need you",
          text: "A form with a captcha, an NDA or an account can't be filled in automatically. Open the page, sign up with the inbox address, then use Mark subscribed.",
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "pipeline-board",
          title: "Your deals, stage by stage",
          text: "Every lead you promoted from the inbox lands here. Drag a card to the next column as the conversation with the seller moves forward.",
          demo: { kind: "board", columns: ["Sourced", "Outreach", "In Discussion"] },
        },
        {
          target: "pipeline-view",
          title: "Board or list",
          text: "The board is good for seeing where everything stands; the list is better for sorting and scanning a lot of leads at once. On a phone this button is in the header and shows the view you would switch to.",
        },
        {
          target: "pipeline-create",
          title: "Add a lead directly",
          text: "Already know who you want to pursue? Create it here instead of going through the inbox — you can set its stage, and attach a contact or organization right away. On a phone it is the + button in the header, next to search.",
          demo: { kind: "vault", fields: ["Title"], button: "Create lead" },
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/projects",
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
          body: ["Create a board and choose its stages — rename, reorder, add or remove them any time from Manage.", "Drag cards between stages.", "Attach contacts, organizations and activities to a card."],
        },
      ],
      tour: [
        {
          target: "projects-board",
          title: "Boards for everything else",
          text: "Leads has its own board. Use these for anything different — a due-diligence checklist, an acquisition you closed, an internal task list.",
          demo: { kind: "board", columns: ["To do", "In progress", "Done"] },
        },
        {
          target: "projects-create",
          title: "Make a board",
          text: "Create a board and name its stages yourself. Cards work the same as on the Leads board.",
          demo: { kind: "vault", fields: ["Name", "Stages"], button: "Create project" },
        },
        {
          target: "projects-manage",
          title: "Manage your boards",
          text: "Open Manage to create a new board — press New project and name its stages yourself — or to rename, reorder the stages of, archive or delete the ones you have. Cards work the same as on the Leads board.",
          demo: { kind: "vault", fields: ["Name", "Stages"], button: "Create project" },
        },
        {
          target: "pipeline-view",
          title: "Board or list",
          text: "Switch how the selected project is shown: columns you can drag cards across, or a list you can scan. On a phone this button is in the header and shows the view you would switch to.",
        },
        {
          target: "projects-new-item",
          title: "Add a card",
          text: "Add an item to the selected project and pick the stage it starts in. On a phone it is the + button in the header, next to search.",
          demo: { kind: "vault", fields: ["Title"], button: "Create item" },
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "activities-filters",
          title: "Finding what needs doing",
          text: "Search by title, contact or lead (on a phone, with the search icon in the header). On the week board you move between weeks and choose which date it follows here; the list can be filtered by Overdue, Today or Next 7 days.",
        },
        {
          target: "activities-view",
          title: "Board or list",
          text: "Switch between the week board (one column per day) and a plain list. On a phone this button is in the header and shows the view you would switch to.",
        },
        {
          target: "activities-list",
          title: "The list",
          text: "Tick one off when it's done. Open it to change the date, who does it, or the lead and contact it belongs to.",
          demo: { kind: "table", columns: ["Title", "Due", "Status"] },
        },
        {
          target: "activities-create",
          title: "Add one",
          text: "Log a call you just had, or plan the next step. Turn on “Enable notification” and the CRM reminds you when it's due. An activity can be attached to a lead, a contact or an organization. On a phone it is the + button in the header.",
          demo: { kind: "vault", fields: ["Title", "Due date"], checkbox: "Enable notification", button: "Create activity" },
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "contacts-tabs",
          title: "People and companies",
          text: "People are the sellers, brokers and advisors you talk to. Organizations are the companies they belong to.",
        },
        {
          target: "contacts-table",
          title: "The list",
          text: "Open anyone to see their history in one place: the leads they are attached to and every call, meeting and email logged with them.",
          demo: { kind: "table", columns: ["Name", "Organization", "Email"] },
        },
        {
          target: "contacts-create-org",
          title: "Add a company",
          text: "For a company with no single contact yet, or to fill in its website and notes up front.",
          demo: { kind: "vault", fields: ["Name", "Website"], button: "Create organization" },
        },
        {
          target: "contacts-create",
          title: "Add someone",
          text: "Add a person or a company by hand. Promoting a lead from the inbox also creates these for you automatically.",
          demo: { kind: "vault", fields: ["Name", "Email"], button: "Create contact" },
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "settings-tabs",
          title: "Where this sits",
          text: "Inbox is one of the settings pages. It is the record of what arrived by email — the leads themselves live in the Leads Inbox.",
        },
        {
          target: "inbox-table",
          title: "Every email that arrived",
          text: "One row per message, with what the AI found in it. Use View to see the businesses it read out and open each one as a lead.",
          demo: { kind: "table", columns: ["Email", "Result", "Received"] },
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "notifications-toggle",
          title: "Alerts on this device",
          text: "Turn this on and the CRM can reach you even when it is closed. The setting belongs to this device and browser, not to your account.",
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "invites-create",
          title: "Invite a teammate",
          text: "Enter their email and they get a link to choose a password. There is no public sign-up — this is the only way in.",
          demo: { kind: "vault", fields: ["Email", "Role"], button: "Send invite" },
        },
        {
          target: "invites-table",
          title: "Who has been invited",
          text: "See which invites are still open, resend one that expired, or revoke one you no longer want.",
          demo: { kind: "table", columns: ["Email", "Role", "Status"] },
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/settings/members",
    build: () => ({
      title: "Members",
      summary: "Everyone in this workspace, and what each person is allowed to do.",
      sections: [
        {
          heading: "Admins and members",
          body: [
            "Members work in the CRM: leads, projects, activities and contacts.",
            "Admins can also invite people, change roles here and see the engine's spend.",
          ],
        },
        {
          heading: "Good to know",
          body: ["A workspace always keeps at least one admin.", "Removing someone takes away their access here; their account and other workspaces are untouched."],
        },
      ],
      tour: [
        {
          target: "members-table",
          title: "The people in this workspace",
          text: "Switch someone between Member and Admin, or remove them. To add a person, send an invite from the Invites tab.",
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/settings/workspace",
    build: () => ({
      title: "Workspace",
      summary: "This workspace's own leads inbox address, and who its email signups sign up as.",
      sections: [
        {
          heading: "The leads inbox address",
          body: "Each workspace has its own address. Anything sent to it becomes leads here and nowhere else, and it is the address the engine uses to subscribe to listing sites.",
        },
        {
          heading: "Who the engine signs up as",
          body: "Listing sites ask for a name, phone and company when you subscribe to their alerts. Fill these in so this workspace's signups use them.",
        },
      ],
      tour: [
        {
          target: "workspace-address",
          title: "This workspace's inbox",
          text: "Forward listing emails here, or use it to subscribe to alerts yourself. Copy it with the button.",
        },
        {
          target: "workspace-buyer",
          title: "Who the engine signs up as",
          text: "The name, phone and company the engine fills in on listing sites' signup forms for this workspace.",
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "application-install",
          title: "Install it as an app",
          text: "Add the CRM to your phone or computer and it opens in its own window, like any other app — with the same data.",
        },
        {
          target: "application-version",
          title: "Staying up to date",
          text: "This tells you whether you are on the latest version, and updates it when you are not.",
        },
        HELP_AGAIN,
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
      tour: [
        {
          target: "spend-summary",
          title: "What the engine costs",
          text: "Every paid call is logged and added up here. The figures are estimates from public prices, not invoices, so use them to compare rather than to reconcile.",
          demo: { kind: "table", columns: ["Service", "Calls", "Cost"] },
        },
        {
          target: "spend-runs",
          title: "Run by run",
          text: "Each search run shows what it cost and what it brought back. If a profile costs more than it is worth, lower its cap or how often it runs.",
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/docs",
    build: () => ({
      title: "How to use the CRM",
      summary: "The guide to the CRM, section by section.",
      sections: [
        {
          heading: "What it's for",
          body: "Use the list on this page to jump to a topic. The (?) button on every other page explains that page in a few lines.",
        },
      ],
      tour: [
        {
          target: "docs-nav",
          title: "Jump to a topic",
          text: "This is the long-form guide. For a quick reminder about the page you are on, use the (?) button in the header instead.",
        },
        HELP_AGAIN,
      ],
    }),
  },
];

/** Help for a route, or null when the page has none. Longest matching prefix wins. */
export function getPageHelp(pathname: string | null, ctx: HelpContext): PageHelp | null {
  if (!pathname) return null;
  // Entries are keyed by workspace-relative route ("/contacts"); the URL is "/w/<slug>/contacts".
  const path = stripWorkspacePrefix(pathname).replace(/\/+$/, "") || "/";
  const entry = ENTRIES.filter((e) => path === e.path || path.startsWith(`${e.path}/`)).sort((a, b) => b.path.length - a.path.length)[0];
  return entry ? entry.build(ctx) : null;
}

/** Every route that has help — used by the test that keeps this file in step with the pages in `app/(hub)`. */
export function helpRoutes(): string[] {
  return ENTRIES.map((e) => e.path);
}

/** Every `data-tour` name the tours point at — used by the test that keeps them in step with the components. */
export function tourTargets(): string[] {
  const targets = new Set<string>();
  for (const entry of ENTRIES) {
    for (const step of entry.build({ inboxAddress: null }).tour) {
      if (step.target) targets.add(step.target);
    }
  }
  return [...targets];
}
