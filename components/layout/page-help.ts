/**
 * The text behind the (?) button in the header: one entry per page, in plain words for someone new to the CRM,
 * plus the guided tour ("Show me") that walks through that page's important parts.
 *
 * EVERY page under `app/(hub)` must have an entry here, with at least one tour step — `page-help.test.ts` fails the
 * build otherwise, and also checks that every `target` below exists as a `data-tour="…"` attribute in the code (and
 * that no `data-tour` is orphaned). When you add, rename or remove a page or one of its main controls, update this
 * file in the same change.
 *
 * Matching is by the longest route prefix (so /contacts/123 would use /contacts if it had no entry of its own), and a
 * `[param]` segment matches any one segment (so `/contacts/[id]` is the entry for /contacts/123). Routes are workspace-relative: the
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

/** Mobile only: the bottom bar shows one group of pages at a time, and a pull-down moves CRM → Traction → EOS → CRM. */
const NAV_SWITCH: TourStep = {
  target: "nav-bottom",
  only: "mobile",
  title: "Switch between CRM, Traction and EOS",
  text: "This bar shows one group of pages at a time. Pull it down (drag it toward the bottom of the screen) to move to the next group: CRM, then Traction, then EOS, then back to the CRM.",
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
          text: "Everything starts here, in three groups: CRM (the Leads Inbox for new finds, Leads for deals you are working, and more), Traction (the weekly rhythm: Scorecard, Rocks, Issues, the L10) and EOS (Vision, People and Process).",
        },
        {
          target: "nav-bottom",
          only: "mobile",
          title: "Getting around",
          text: "These icons switch between the main parts of the CRM: the inbox of new finds, the leads you are working, and more. Pull the bar down (drag it toward the bottom of the screen) to move to Traction's pages, again for EOS, and once more to come back. Your avatar on the far right opens the account menu: settings, workspaces, dark mode and sign out.",
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
          text: "Every lead you promoted from the inbox lands here. Drag a card to the next column as the conversation with the seller moves forward. Open one and press Edit details to change its title, organization, contact or notes.",
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
          text: "Tick one off when it's done. Open one and press Edit activity to change its title, date, who does it, or the lead and contact it belongs to.",
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
          title: "People, companies and your team",
          text: "People are the sellers, brokers and advisors you talk to; Organizations are the companies they belong to. Team is your own company's people: whoever can own a Rock, a number or a To-Do, with or without a login.",
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
    path: "/contacts/[id]",
    build: () => ({
      title: "Contact",
      summary: "Everything about one person: how to reach them, their company, and every lead, project and activity they are part of.",
      sections: [
        {
          heading: "What it's for",
          body: "Open someone from the Contacts list to see their whole history in one place before you call or write. Nothing here is a copy: the leads, projects and activities listed are the real ones, so a change made here shows up everywhere.",
        },
        {
          heading: "What you can do",
          body: [
            "Edit their name, email and phone with the pencil, or tap the email or phone to write or call.",
            "Pick, change or create their organization.",
            "Open a lead, a project item or an activity to read it, move it to another stage, tick it done, or edit it — the same panel you get on the Leads, Projects and Activities pages.",
            "Use the back arrow to return to the list.",
          ],
        },
      ],
      tour: [
        {
          target: "contact-profile",
          title: "Who this is",
          text: "Their name, company, email and phone at a glance. The email and phone are links: tap one to write or call.",
        },
        {
          target: "contact-edit",
          title: "Fix or complete the details",
          text: "Press the pencil to edit the name, email and phone right here, then Save. Nothing else on the page changes.",
          demo: { kind: "vault", fields: ["Name", "Email", "Phone"], button: "Save" },
        },
        {
          target: "contact-organization",
          title: "Which company they belong to",
          text: "Choose an organization from the list, switch to another, or type a new name and create it on the spot. View organization opens that company in the Contacts list.",
        },
        {
          target: "contact-leads",
          title: "Leads they are on",
          text: "Every lead this person is attached to, with its current stage. Open one to move it forward, edit it or add activities. A lead lands here when you pick this person as its contact.",
          demo: { kind: "table", columns: ["Lead", "Stage"] },
        },
        {
          target: "contact-projects",
          title: "Projects they are part of",
          text: "The same idea for your own boards: each card this person is linked to, which project it is in, and its stage.",
          demo: { kind: "table", columns: ["Item", "Project", "Stage"] },
        },
        {
          target: "contact-activities",
          title: "Calls, meetings and tasks",
          text: "Everything planned or done with them, open ones first. The badge counts how many are finished. Open one to edit it or tick it done.",
          demo: { kind: "table", columns: ["Title", "Type", "Due"] },
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
          text: "One row per message, with what the AI found in it. Click one (or Open) to read the email beside the list, with the businesses it read out.",
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
    path: "/traction",
    build: () => ({
      title: "Traction",
      summary: "The weekly rhythm of the company's operating system (EOS) on one screen.",
      sections: [
        {
          heading: "What it's for",
          body: "Every company in the portfolio runs the same system. This page shows where this one stands this week, when the next L10 is, and where the system is being used against an EOS rule.",
        },
        {
          heading: "How the pieces connect",
          body: [
            "Scorecard: a number that misses its goal turns red.",
            "Rocks: a 90-day priority that slips is marked off track.",
            "Issues: either one goes to the Issues List in one click.",
            "L10: the weekly meeting solves the top three issues.",
            "To-Dos: each solution becomes a 7-day To-Do, kept in Activities.",
          ],
        },
        {
          heading: "Where the rest lives",
          body: "The V/TO, the Accountability Chart, the People Analyzer and the core processes are in the EOS group: Vision, People and Process.",
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "traction-tiles",
          title: "This week at a glance",
          text: "The Scorecard's latest numbers, this quarter's Rocks, open issues and how many L10 To-Dos are done. Tap a tile to open its page.",
        },
        {
          target: "traction-next-l10",
          title: "The next L10",
          text: "The top three issues it will solve, its standing day and time, and the way in. While a meeting runs it says so, and the button joins it.",
        },
        {
          target: "traction-checks",
          title: "EOS checks",
          text: "Each line is a rule EOS expects that isn't met yet: a number with no owner, too few Rocks, a meeting rated under 8. Fix them and this list empties.",
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/traction/scorecard",
    build: () => ({
      title: "Scorecard",
      summary: "The handful of numbers that tell you how the company is doing, entered every week or month.",
      sections: [
        {
          heading: "What it's for",
          body: "Each measurable has one owner and one goal. Enter the number each period and the cell turns green (on goal) or red (off goal) on its own.",
        },
        {
          heading: "What you can do",
          body: [
            "Click a cell to type the number. Empty it to clear it.",
            "Click a red cell and choose Drop to Issues, so the L10 deals with it.",
            "Click a measurable's name to change its owner, goal or unit, or to archive it.",
            "Use the arrows to look further back. The quarter column rolls up the whole quarter.",
          ],
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "scorecard-cadence",
          title: "Weekly or monthly",
          text: "Each measurable is entered either every week or every month. Switch here to see one group or the other.",
        },
        {
          target: "scorecard-grid",
          title: "The grid",
          text: "One row per number, one column per week or month (on a phone, one card per number with its latest value big). Click a cell to enter the number; a red one can be dropped to Issues.",
          demo: { kind: "table", columns: ["Measurable", "Goal", "Jul", "Aug", "Sep"] },
        },
        {
          target: "scorecard-checks",
          title: "What EOS expects",
          text: "5 to 15 numbers, each with one owner and a goal, entered weekly. Anything missing shows up here.",
        },
        {
          target: "scorecard-enter",
          title: "Enter the numbers",
          text: "Opens one field per measurable for this week (or month): type each number and save them all at once. On a phone, tapping a measurable's period opens just that one.",
        },
        {
          target: "scorecard-standard",
          title: "The portfolio's standard numbers",
          text: "Every company in the portfolio reports a few of the same numbers, so they compare side by side. This adds the ones this company doesn't have yet; then give each one its owner.",
        },
        {
          target: "scorecard-add",
          title: "Add a measurable",
          text: "Give it a name, one owner and a goal: at least, at most, exactly, or a range. Without a goal the cells stay neutral, never red or green.",
          demo: { kind: "vault", fields: ["Name", "Owner", "Goal"], button: "Add measurable" },
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/traction/rocks",
    build: () => ({
      title: "Rocks",
      summary: "The company's 90-day priorities, one quarter at a time.",
      sections: [
        {
          heading: "What it's for",
          body: "A Rock is something that must get done this quarter, with one owner, a due date and a clear finish line. EOS recommends 3 to 7 per quarter.",
        },
        {
          heading: "What you can do",
          body: [
            "Change a Rock's status from its pill: on track, off track, complete or dropped.",
            "When a Rock is off track, drop it to Issues so the L10 can solve it.",
            "After a quarter ends, close out each unfinished Rock: complete it, carry it into the next quarter, or drop it.",
            "Click a Rock to edit it, move it to another quarter or delete it.",
          ],
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "rocks-quarters",
          title: "Pick a quarter",
          text: "Each quarter has its own Rocks. The current one is marked now; past quarters keep their history.",
        },
        {
          target: "rocks-list",
          title: "The quarter's Rocks",
          text: "Company Rocks first, then each person's individual Rocks. Each shows its owner, finish line, due date, status and the 1-Year goal it moves.",
          demo: { kind: "table", columns: ["Rock", "Owner", "Status"] },
        },
        {
          target: "rocks-rate",
          title: "Done is binary",
          text: "The share of the quarter's Rocks that are complete; the target is 80%. When a quarter ends, each unfinished Rock is completed, carried into the next quarter, or dropped.",
        },
        {
          target: "rocks-add",
          title: "Add a Rock",
          text: "Write it so anyone could check whether it's done, give it one owner, and pick the 1-Year goal it moves.",
          demo: { kind: "vault", fields: ["Rock", "Owner", "Done when"], button: "Add Rock" },
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/traction/issues",
    build: () => ({
      title: "Issues",
      summary: "Everything in the way, ranked, so the L10 solves what matters most first.",
      sections: [
        {
          heading: "What it's for",
          body: "Every issue has a kind. A problem is solved; an idea is decided yes, no or later; an obstacle (something blocking a Rock) is removed or escalated. The weekly L10 ranks the list and works the top three, one at a time.",
        },
        {
          heading: "The two lists",
          body: ["This week (L10): solved in the weekly meeting.", "Long term (V/TO): bigger topics, worked at the quarterly."],
        },
        {
          heading: "IDS",
          body: [
            "Identify: write the real issue in one sentence, the root cause and not the symptom.",
            "Discuss: everyone weighs in, no tangents, 5 to 15 minutes.",
            "Solve: record the decision and its To-Dos, each with one owner and a due date. They land in Activities and the next L10.",
          ],
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "issues-horizon",
          title: "Short or long term",
          text: "Weekly issues are solved in the L10. Long-term ones belong to the V/TO and the quarterly meeting.",
        },
        {
          target: "issues-list",
          title: "Ranked list",
          text: "The top three (dark numbers) are what the next L10 works on. Each shows its kind and how long it has been open; four weeks or more turns red. Use the menu to move it, edit its root cause, drop or delete it.",
          demo: { kind: "table", columns: ["#", "Issue", "Owner"] },
        },
        {
          target: "issues-add",
          title: "Add an issue",
          text: "Anyone can add one. Red Scorecard cells and off-track Rocks arrive here when someone drops them.",
          demo: { kind: "vault", fields: ["Issue", "Details", "Owner"], button: "Add issue" },
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/traction/l10",
    build: () => ({
      title: "L10 Meeting",
      summary: "The weekly leadership meeting, run step by step from the CRM.",
      sections: [
        {
          heading: "What it's for",
          body: "The operator runs the L10 every week, same day and time, with the leadership team. Each step shows live data (the Scorecard, Rocks, To-Dos and Issues), so nothing is copied by hand. It is called a Level 10 because the goal is for everyone to rate it a 10.",
        },
        {
          heading: "Same day, same time",
          body: "An admin sets the standing day and time. An hour before each meeting, everyone on the team gets a reminder with its points: a push on the app, and an email.",
        },
        {
          heading: "The agenda (90 minutes)",
          body: [
            "Segue (5 min): each person shares one personal and one professional best from the week.",
            "Scorecard (5 min): read each number; on goal or off. Off goes to Issues, no discussion here.",
            "Rock Review (5 min): each owner says on track or off track. Off track goes to Issues.",
            "Customer / Employee Headlines (5 min): one-line news. Anything that needs talking goes to Issues.",
            "To-Do List (5 min): each To-Do is done or not done. The target is 90% done.",
            "IDS (60 min): Identify, Discuss, Solve the top three issues, one at a time. Each solution becomes a To-Do.",
            "Conclude (5 min): recap the new To-Dos; everyone rates the meeting from 1 to 10 from their own device.",
          ],
        },
        {
          heading: "After the meeting",
          body: "Conclude records the meeting with this week's numbers. Under an 8 average, it asks what would make the next one a 10. It shows on the Overview, in History and in the owner's Portfolio.",
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "l10-schedule",
          title: "Same day, same time",
          text: "The standing day and time. An hour before, everyone gets a push and an email with the meeting's points. An admin can change it here.",
        },
        {
          target: "l10-start",
          title: "Start the meeting",
          text: "Starting it opens the meeting for everyone: each person can then rate it from their own phone or computer.",
        },
        {
          target: "l10-live",
          title: "While it runs",
          text: "Everyone sees this bar, with their own rating one tap away. It also counts how many have rated.",
        },
        {
          target: "l10-agenda",
          title: "The agenda",
          text: "Seven steps, 90 minutes, in this order every week. Click a step to jump to it; the right side then shows what that step needs.",
        },
        {
          target: "l10-timer",
          title: "The timer",
          text: "Press Start when a step begins. Each step has its own time box, and the clock turns red when it runs over, so the meeting ends on time.",
        },
        {
          target: "l10-agenda",
          title: "1 · Segue (5 min)",
          text: "Everyone shares one personal and one professional best from the past week. It moves the team from working in the business to working on it.",
        },
        {
          target: "l10-agenda",
          title: "2 · Scorecard (5 min)",
          text: "Read each measurable's latest number against its goal. Say on or off, nothing more. Press Drop to Issues on a red one; it gets discussed in IDS, not now.",
        },
        {
          target: "l10-agenda",
          title: "3 · Rock Review (5 min)",
          text: "Each owner says whether their Rock is on track or off track, and changes its status here. An off-track Rock goes to Issues with one click.",
        },
        {
          target: "l10-agenda",
          title: "4 · Headlines (5 min)",
          text: "Quick good or bad news about customers and employees, one line each, typed into the box. Anything that needs a conversation becomes an issue.",
        },
        {
          target: "l10-agenda",
          title: "5 · To-Do List (5 min)",
          text: "Go down last week's To-Dos: done or not done, tick the box. The percentage at the top should be 90% or more. New To-Dos (with one owner) can be added at the bottom.",
        },
        {
          target: "l10-agenda",
          title: "6 · IDS (60 min)",
          text: "The heart of the meeting. Take the top three issues one at a time: Identify the root cause, Discuss it (the issue's own timer turns red after 15 minutes), Solve it with a decision and its To-Dos.",
        },
        {
          target: "l10-agenda",
          title: "7 · Conclude (5 min)",
          text: "Recap the new To-Dos. Everyone rates the meeting from 1 to 10 from their own device; a teammate without a login is rated for here. Under an 8 average, write what would make it a 10, then conclude.",
        },
        {
          target: "l10-section",
          title: "The step's live data",
          text: "Everything here is the real data from the Scorecard, Rocks, Activities and Issues. Changes you make during the meeting are saved right away.",
        },
        {
          target: "l10-ratings",
          title: "Everyone's rating",
          text: "Ratings arrive as people send them from their own devices. Yours is the one you can change; a teammate without a login can be rated for.",
        },
        {
          target: "l10-history",
          title: "Past meetings",
          text: "History lists every concluded L10: its rating, who rated what, the headlines and the week's numbers.",
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/traction/l10/history",
    build: () => ({
      title: "Meeting history",
      summary: "Every concluded L10, newest first.",
      sections: [
        {
          heading: "What it's for",
          body: "Each time a meeting is concluded, the CRM keeps a snapshot: the average rating and each person's, the headlines, and that week's numbers (To-Dos done, issues solved, Rocks off track, measurables off goal).",
        },
        {
          heading: "Reading it",
          body: "Look for trends: ratings dropping, To-Dos staying under 90%, the same Rocks off track week after week. Those are issues worth raising.",
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "l10-history-list",
          title: "One card per meeting",
          text: "The date and rating at the top, the week's numbers below (red when off), then who rated what and the headlines.",
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/eos/vision",
    build: () => ({
      title: "Vision / Traction Organizer",
      summary: "The company's vision and plan on one page: the V/TO.",
      sections: [
        {
          heading: "What it's for",
          body: "Where the company is going (core values, core focus, the 10-year target, the marketing strategy) and how it gets there (the 3-year picture, the 1-year plan, this quarter's Rocks, the long-term issues). Share it with the whole company.",
        },
        {
          heading: "What EOS expects",
          body: [
            "3 to 7 core values, each with 2–3 behaviors you can see, so they can be used to hire, review and fire.",
            "A 3-year picture with revenue, profit, people and customers.",
            "A 1-year plan with 3 to 7 specific, measurable goals — and Rocks that move each of them.",
          ],
        },
        {
          heading: "Good to know",
          body: "Blank parts show as dashed gaps on purpose: they are work still to do. Dates only take real dates and money only takes amounts (600000 or 3M). The Rocks and Issues sections come live from their own pages.",
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "vto-vision",
          title: "Vision",
          text: "Who the company is and where it's going. These change rarely, so revisit them at the annual planning.",
        },
        {
          target: "vto-traction",
          title: "Traction",
          text: "The 3-year picture and the 1-year plan, plus this quarter's Rocks and the long-term issues, taken live from their pages.",
        },
        {
          target: "vto-goals",
          title: "Goals and Rocks",
          text: "Each 1-Year goal shows how many of this quarter's Rocks move it. A goal with none is in red: no one is working on it this quarter.",
        },
        {
          target: "vto-edit",
          title: "Edit the V/TO",
          text: "Update it at each quarterly. Core values take their behaviors, goals are one per row, dates use a date picker, and money takes an amount like 600000 or 3M.",
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/eos/people",
    build: () => ({
      title: "People",
      summary: "The Accountability Chart and the People Analyzer: the right people in the right seats.",
      sections: [
        {
          heading: "Accountability Chart",
          body: "The company's seats, who sits in each, and each seat's 3–5 roles. One person per seat — shared accountability is no accountability. A person may hold more than one seat, or none yet. Everyone sees the chart; admins shape it.",
        },
        {
          heading: "People Analyzer",
          body: [
            "Right person: + / +− / − on each core value. All + is the bar; one +− is a conversation; any − means wrong person.",
            "Right seat: yes or no on Gets it, Wants it, Capacity to do it. All three must be yes.",
            "It is private: you see your own reviews and your direct reports'; admins see everyone's. The manager's review and the self review are compared in the Quarterly Conversation.",
          ],
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "people-tabs",
          title: "Chart or Analyzer",
          text: "The Accountability Chart shows who sits where; the People Analyzer reviews whether they are the right person in the right seat.",
        },
        {
          target: "people-chart",
          title: "The chart",
          text: "Each seat with its person and roles. An empty seat is outlined in red. Who sits above whom decides who reviews whom.",
        },
        {
          target: "people-add-seat",
          title: "Add a seat",
          text: "Admins add seats: start with the Visionary and the Integrator, then a seat per major function.",
        },
        {
          target: "people-analyzer",
          title: "Reviews, privately",
          text: "Each row shows the manager's and the self review for the quarter. Review your direct reports, and fill in your own self review.",
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/eos/process",
    build: () => ({
      title: "Core processes",
      summary: "The handful of processes that make the company run the same way every time.",
      sections: [
        {
          heading: "What it's for",
          body: "Document the 20% of processes that give 80% of the consistency — usually HR, sales, operations, customer service and finance. 5 to 20 major steps each, with just enough detail.",
        },
        {
          heading: "Followed by all",
          body: "A process moves from documented, to trained, to followed by all (FBA). Review each one every quarter; one not reviewed in 90 days is flagged.",
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "process-list",
          title: "Processes by area",
          text: "Open one to see its steps. Each shows its owner, where it stands, and when it was last reviewed.",
        },
        {
          target: "process-add",
          title: "Add a process",
          text: "Name it the way people say it, give it one owner, and list its major steps.",
          demo: { kind: "vault", fields: ["Name", "Owner", "Steps"], button: "Add process" },
        },
        HELP_AGAIN,
      ],
    }),
  },
  {
    path: "/eos/checkup",
    build: () => ({
      title: "Organizational Checkup",
      summary: "The company scored on the 20 EOS statements, saved so the movement can be measured.",
      sections: [
        {
          heading: "What it's for",
          body: "The leadership team rates the company together, 1 (weak) to 5 (strong), on 20 statements covering the six EOS components. The total is a 0–100% score.",
        },
        {
          heading: "When to take it",
          body: "At kickoff, to set the baseline, and again later — the playbook asks for month 12. Under 40% needs focus, 40–69% is building the foundation, 70% and up is strong and scalable.",
        },
      ],
      tour: [
        NAV_SWITCH,
        {
          target: "checkup-form",
          title: "Score each statement",
          text: "Tap 1 to 5 for every statement. The score at the top updates as you go; it saves once all 20 are scored.",
        },
        {
          target: "checkup-summary",
          title: "Kickoff, latest, movement",
          text: "The first checkup is the baseline. The latest one is compared against it, in points.",
        },
        {
          target: "checkup-statements",
          title: "Statement by statement",
          text: "Where the company moved and where it didn't, from the kickoff to the latest checkup.",
        },
        {
          target: "checkup-new",
          title: "Take it again",
          text: "Each new checkup is saved with its date, so the history shows the trend.",
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

/**
 * Whether an entry's route covers `path`: every segment of the entry must match the start of the path, where a
 * `[param]` segment (an `app/` dynamic folder, e.g. `/contacts/[id]`) matches any single segment.
 */
function routeMatches(entryPath: string, path: string): boolean {
  const entrySegments = entryPath.split("/");
  const segments = path.split("/");
  if (segments.length < entrySegments.length) return false;
  return entrySegments.every((segment, i) => (segment.startsWith("[") && segment.endsWith("]") ? segments[i] !== "" : segment === segments[i]));
}

/** Help for a route, or null when the page has none. Longest matching prefix wins. */
export function getPageHelp(pathname: string | null, ctx: HelpContext): PageHelp | null {
  if (!pathname) return null;
  // Entries are keyed by workspace-relative route ("/contacts"); the URL is "/w/<slug>/contacts".
  const path = stripWorkspacePrefix(pathname).replace(/\/+$/, "") || "/";
  const entry = ENTRIES.filter((e) => routeMatches(e.path, path)).sort(
    (a, b) => b.path.split("/").length - a.path.split("/").length || b.path.length - a.path.length
  )[0];
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
