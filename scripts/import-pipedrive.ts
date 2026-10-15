import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { DEFAULT_BOARD_COLUMNS, DEFAULT_BOARD_NAME } from "../modules/pipeline/pipeline.constants";

/**
 * Imports Tanner's Pipedrive exports (People, Deals, Activities — CSV) into an EXISTING workspace (default:
 * tagr-holdings), sorting each record into where it belongs in this CRM instead of copying Pipedrive's one funnel:
 *
 *   - People → contacts (with their organization, first email, first phone).
 *   - Deals are routed by ROUTES (keyed by the cleaned-up title):
 *       lead (default) → a card on the Leads board — acquisitions and outside opportunities
 *       project        → a card on one of PROJECTS' boards (partnerships, financing, internal initiatives)
 *       issue          → a Traction Issue — a decision, not a deal
 *       task           → a plain task in Activities — a personal goal
 *     Internal items get the organization of the company they belong to (ROUTES' `org`), so they can be filtered —
 *     and moved — per company later, when each company gets its own workspace.
 *   - Activities → activities, linked to whatever their deal became (a card, or an Issue). ACTIVITY_AS_ISSUE lists
 *     the ones that are really an idea for the Issues List, not a to-do.
 *   Activity type is read from the subject: "Call…" → call, lunch/meeting/committee → meeting, anything else → task.
 *   "Activity - Duration" goes into the notes. Dates are Phoenix time (UTC-7, no DST); a date without a time is stored
 *   as local midnight — what the app's own date-only picker stores.
 *
 * Titles and subjects are cleaned up on the way in (FIXES: typos, spacing, punctuation) — the cleaned text is what
 * ROUTES and the activity → deal links match on. Pipedrive gives no stage, so every card starts in its board's first
 * column.
 *
 * People: a team person is found by name, else created with its KNOWN_EMAILS email, so their login links itself
 * once they accept an invite with that email (team.service's syncMembers); IMPORT_ASSIGNEE_EMAIL links an account
 * that already exists. A contact named in KNOWN_EMAILS gets that email too.
 *
 * Re-runnable: organizations, contacts, boards, cards and Issues are matched by name/title (an existing contact or
 * person only gets an email/phone it is missing), and an activity with the same subject, due date, contact, card
 * and Issue is skipped.
 *
 * Like scripts/migrate-explicit.ts it never reads the repo's env files or `.neon`: you type the database and the host
 * must match. Without IMPORT_APPLY=yes everything runs in a transaction that is ROLLED BACK (a dry run that still
 * checks every constraint) and prints what it would do.
 *
 * Usage (any of the three CSVs can be left out):
 *   SEED_DATABASE_URL="postgresql://...unpooled-host.../neondb?..." \
 *   SEED_EXPECT_HOST="ep-your-branch-id" \
 *   IMPORT_PEOPLE_CSV="C:/path/people.csv" \
 *   IMPORT_DEALS_CSV="C:/path/deals.csv" \
 *   IMPORT_ACTIVITIES_CSV="C:/path/activities.csv" \
 *   [IMPORT_WORKSPACE_SLUG="tagr-holdings"] \
 *   [IMPORT_ASSIGNEE_EMAIL="someone@example.com"] \
 *   [IMPORT_APPLY=yes] \
 *   npx tsx scripts/import-pipedrive.ts
 */
const connectionString = process.env.SEED_DATABASE_URL;
const expectHost = process.env.SEED_EXPECT_HOST;
const peoplePath = process.env.IMPORT_PEOPLE_CSV;
const dealsPath = process.env.IMPORT_DEALS_CSV;
const activitiesPath = process.env.IMPORT_ACTIVITIES_CSV;
const slug = process.env.IMPORT_WORKSPACE_SLUG?.trim() || "tagr-holdings";
const assigneeEmail = process.env.IMPORT_ASSIGNEE_EMAIL?.trim().toLowerCase() || null;
const apply = process.env.IMPORT_APPLY === "yes";
if (!connectionString) throw new Error("Set SEED_DATABASE_URL to the exact connection string to write to.");
if (!expectHost) throw new Error("Set SEED_EXPECT_HOST to a substring of the expected database host, as a safety check.");
if (!peoplePath && !dealsPath && !activitiesPath) throw new Error("Set IMPORT_PEOPLE_CSV, IMPORT_DEALS_CSV and/or IMPORT_ACTIVITIES_CSV.");
const host = new URL(connectionString).host;
if (!host.includes(expectHost)) throw new Error(`Refusing to run: host "${host}" does not contain expected "${expectHost}".`);

// ───────────────────────────── The plan ─────────────────────────────

/** Typos, spacing and punctuation, by the exact Pipedrive text. Anything not listed is kept as-is (trimmed). */
const FIXES: Record<string, string> = {
  // Deal titles
  "Talon Air- MPA Acquisition": "Talon Air - MPA Acquisition",
  "MPA- Evaluate Crane vs Acquisition": "MPA: evaluate Mesa Crane vs. an acquisition",
  "Unified- Upland Group PM Acquisition": "Unified - Upland Group PM Acquisition",
  "MBB/MDT- Spencer Chipping recruit": "MBB/MDT - Recruit Spencer Chipping",
  "Andrew Segal- JV": "Andrew Segal - JV",
  "Dakota PM acquisition": "Dakota PM Acquisition",
  "Maggie Intranet Skeleton done": "Maggie intranet skeleton done",
  "CMO resource-Who identified": "CMO resource identified",
  "MPA marketing rock": "MPA marketing",
  "Level 5 leadership training SP/Por": "Level 5 leadership training (SP/POR)",
  "90 day spanish plan": "90-day Spanish plan",
  "Use the Cost Seg or Not??": "Use a cost segregation study or not?",
  "Menlo Merger - WIP": "Menlo merger",
  "VA Hired for all projects": "VA hired for all projects",
  // Activity subjects
  "Family Investment Committ": "Family Investment Committee",
  "Call cannok": "Call Cannok",
  "Did meeting happen": "Did the meeting happen?",
  "How are things": "How are things?",
  "Did I get financials": "Did I get the financials?",
  "Did we get financials": "Did we get the financials?",
  "Whats next?": "What's next?",
  "what's next?": "What's next?",
  "Reach out to Schedule lunch": "Reach out to schedule lunch",
  "Griunded and mpa on ever cre deal": "Grounded and MPA on every CRE deal",
  "Get with Adam on Bell bank for Merger": "Get with Adam on Bell Bank for the merger",
  "Opportunity to collaborate for grounded": "Opportunity to collaborate with Grounded",
  "Send out Texts for Grounded": "Send out texts for Grounded",
};
const fix = (text: string) => FIXES[text.trim()] ?? text.trim();

/** The project boards the non-lead deals go to, with their own stages. */
const PROJECTS = {
  partnerships: {
    name: "Partnerships & Recruiting",
    columns: [
      { id: "identified", label: "Identified" },
      { id: "in_talks", label: "In Talks" },
      { id: "terms", label: "Terms" },
      { id: "signed", label: "Signed" },
    ],
  },
  financing: {
    name: "Financing",
    columns: [
      { id: "need_identified", label: "Need Identified" },
      { id: "lender_talks", label: "Lender Talks" },
      { id: "terms", label: "Terms" },
      { id: "approved", label: "Approved" },
    ],
  },
  initiatives: {
    name: "Internal Initiatives",
    columns: [
      { id: "not_started", label: "Not Started" },
      { id: "in_progress", label: "In Progress" },
      { id: "done", label: "Done" },
    ],
  },
} as const;
type ProjectKey = keyof typeof PROJECTS;

const GROUNDED = "Grounded Pest Control";
const MPA = "Mountain Peak Air";

type Route =
  | { kind: "project"; project: ProjectKey; org?: string }
  | { kind: "issue"; issueType: "problem" | "idea" | "obstacle"; notes?: string }
  | { kind: "task" };

/** Deals that aren't leads, by cleaned-up title. Every other deal is a lead (acquisitions, outside opportunities). */
const ROUTES: Record<string, Route> = {
  // Partnerships, joint ventures and recruiting — not a company being bought.
  "Merrill Pest Solutions": { kind: "project", project: "partnerships" }, // its activity: "discuss JV"
  "Andrew Segal - JV": { kind: "project", project: "partnerships" },
  "MBB/MDT Deal Scout": { kind: "project", project: "partnerships" },
  "MBB/MDT - Recruit Spencer Chipping": { kind: "project", project: "partnerships" },
  // Credit lines and the merger's bank financing.
  "Grounded Vehicle LOC": { kind: "project", project: "financing", org: GROUNDED },
  "MPA/MPP - LOC": { kind: "project", project: "financing", org: MPA },
  "Menlo merger": { kind: "project", project: "financing", org: "Menlo Group" },
  // Internal goals per company (several are written like EOS Rocks).
  "Maggie intranet skeleton done": { kind: "project", project: "initiatives", org: MPA },
  "Develop draft of an acquisition strategy": { kind: "project", project: "initiatives", org: MPA },
  "CMO resource identified": { kind: "project", project: "initiatives", org: MPA },
  "MPA operating agreement": { kind: "project", project: "initiatives", org: MPA },
  "MPA marketing": { kind: "project", project: "initiatives", org: MPA },
  "Vendor Program Rolled Out": { kind: "project", project: "initiatives", org: "Unified" },
  "Marketing Plan for Unified": { kind: "project", project: "initiatives", org: "Unified" },
  "Finish Grounded Website": { kind: "project", project: "initiatives", org: GROUNDED },
  "VA hired for all projects": { kind: "project", project: "initiatives" },
  // Decisions — worked in the L10 with IDS.
  "Use a cost segregation study or not?": { kind: "issue", issueType: "idea" },
  "MPA: evaluate Mesa Crane vs. an acquisition": { kind: "issue", issueType: "idea", notes: `${MPA}.` },
  // Personal goals.
  "Level 5 leadership training (SP/POR)": { kind: "task" },
  "90-day Spanish plan": { kind: "task" },
};

/** Activities (cleaned-up subject) that are an idea for the Issues List rather than a to-do. */
const ACTIVITY_AS_ISSUE: Record<string, { issueType: "problem" | "idea" | "obstacle"; notes?: string }> = {
  "Grounded and MPA on every CRE deal": { issueType: "idea", notes: "Bring Grounded and Mountain Peak Air into every CRE deal." },
};

/**
 * Emails the exports don't carry, by (lower-case) name. Used for the team person — when that person later signs up
 * with the same email and joins the workspace, their login is linked to them on its own — and for the contact of the
 * same name (Pipedrive lists the owner as the contact on internal to-dos).
 */
const KNOWN_EMAILS: Record<string, string> = {
  "tanner milne": "tanner@tagrholdings.com",
};

// ───────────────────────────── CSV ─────────────────────────────

/** RFC 4180-ish: quoted fields, "" escapes, commas/newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

type Getter = (row: string[]) => string;

/** The CSV's rows, with a getter per named column — a missing column is an error, not a silent blank. */
function readCsv(path: string, kind: string) {
  const [header, ...rows] = parseCsv(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  const col = (name: string): Getter => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`The CSV has no "${name}" column — is this a Pipedrive ${kind} export?`);
    return (row) => (row[index] ?? "").trim();
  };
  const first = (getters: Getter[], row: string[]) => getters.map((g) => g(row)).find(Boolean) ?? "";
  return { rows, col, first };
}

/** 10 US digits → "602-686-2642"; anything else is kept as typed. */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : value;
}

interface CsvPerson {
  name: string;
  organization: string;
  email: string;
  phone: string;
}

function readPeople(path: string): CsvPerson[] {
  const { rows, col, first } = readCsv(path, "people");
  const name = col("Person - Name");
  const org = col("Person - Organization");
  const emails = ["Person - Email - Work", "Person - Email - Home", "Person - Email - Other"].map(col);
  const phones = ["Person - Phone - Mobile", "Person - Phone - Work", "Person - Phone - Home", "Person - Phone - Other"].map(col);
  return rows.map((row) => ({ name: name(row), organization: org(row), email: first(emails, row), phone: formatPhone(first(phones, row)) }));
}

interface CsvDeal {
  title: string;
  value: string;
  organization: string;
  contact: string;
  expectedClose: string;
  owner: string;
}

function readDeals(path: string): CsvDeal[] {
  const { rows, col } = readCsv(path, "deals");
  const [title, value, org, contact, expectedClose, owner] = [
    "Deal - Title",
    "Deal - Value",
    "Deal - Organization",
    "Deal - Contact person",
    "Deal - Expected close date",
    "Deal - Owner",
  ].map(col);
  return rows.map((row) => ({
    title: fix(title(row)),
    value: value(row),
    organization: org(row),
    contact: contact(row),
    expectedClose: expectedClose(row),
    owner: owner(row),
  }));
}

interface CsvActivity {
  done: boolean;
  subject: string;
  deal: string;
  due: string;
  priority: string;
  contact: string;
  email: string;
  phone: string;
  organization: string;
  duration: string;
  assignedTo: string;
}

function readActivities(path: string): CsvActivity[] {
  const { rows, col, first } = readCsv(path, "activities");
  const [done, subject, deal, due, priority, contact, duration, org, assigned] = [
    "Activity - Done",
    "Activity - Subject",
    "Activity - Deal",
    "Activity - Due date",
    "Activity - Priority",
    "Activity - Contact person",
    "Activity - Duration",
    "Activity - Organization",
    "Activity - Assigned to user",
  ].map(col);
  const emails = ["Person - Email - Work", "Person - Email - Home", "Person - Email - Other"].map(col);
  const phones = ["Person - Phone - Mobile", "Person - Phone - Work", "Person - Phone - Home", "Person - Phone - Other"].map(col);
  return rows.map((row) => ({
    done: done(row).toLowerCase() === "done",
    subject: fix(subject(row)),
    deal: fix(deal(row)),
    due: due(row),
    priority: priority(row).toLowerCase(),
    contact: contact(row),
    email: first(emails, row),
    phone: formatPhone(first(phones, row)),
    organization: org(row),
    duration: duration(row),
    assignedTo: assigned(row),
  }));
}

/** What a deal carries that a card has no field for: its value and expected close date. */
function dealNotes(deal: CsvDeal): string | null {
  const value = Number(deal.value.replace(/[^0-9.]/g, ""));
  const lines = [value > 0 ? `Value: $${value.toLocaleString("en-US")}` : null, deal.expectedClose ? `Expected close: ${deal.expectedClose.slice(0, 10)}` : null];
  return lines.filter(Boolean).join("\n") || null;
}

function activityType(subject: string): "call" | "meeting" | "task" {
  if (/^call\b/i.test(subject)) return "call";
  if (/\b(lunch|meeting|committee)/i.test(subject)) return "meeting";
  return "task";
}

/**
 * "2026-09-09" / "2026-09-14 15:30:00", Phoenix wall-clock (UTC-7) → the UTC timestamp the app stores, as text for a
 * `timestamp without time zone` column (passing a JS Date would make node-pg write this machine's local time).
 */
function phoenixToUtc(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(value);
  if (!match) return null;
  const [, date, hh = "00", mm = "00"] = match;
  return new Date(`${date}T${hh}:${mm}:00-07:00`).toISOString().replace("T", " ").replace("Z", "");
}

/** "01:00" → "Duration: 1h", "00:30" → "Duration: 30 min". */
function durationNote(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!hours && !minutes) return null;
  return `Duration: ${[hours && `${hours}h`, minutes && `${minutes} min`].filter(Boolean).join(" ")}`;
}

const PRIORITIES = new Set(["low", "medium", "high"]);

// ───────────────────────────── DB ─────────────────────────────

type Row = Record<string, unknown>;
async function insert(db: PoolClient, table: string, row: Row) {
  const keys = Object.keys(row);
  const values = keys.map((k) => (row[k] !== null && typeof row[k] === "object" ? JSON.stringify(row[k]) : row[k]));
  await db.query(`insert into public.${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`, values);
}

/** Case-insensitive "find by name in this workspace, else create" — remembered for the rest of the run. */
function finder(db: PoolClient, tenantId: string, table: string, nameColumn: string, extraWhere = "", extraParams: unknown[] = []) {
  const cache = new Map<string, { id: string; created: boolean }>();
  return async (name: string, create: (id: string) => Promise<void>) => {
    const key = name.toLowerCase();
    const known = cache.get(key);
    if (known) return known;
    const { rows } = await db.query<{ id: string }>(
      `select id::text as id from public.${table} where tenant_id = $1 and lower(${nameColumn}) = $2 ${extraWhere} order by created_at limit 1`,
      [tenantId, key, ...extraParams]
    );
    const found = rows[0] ? { id: rows[0].id, created: false } : { id: randomUUID(), created: true };
    if (found.created) await create(found.id);
    cache.set(key, found);
    return found;
  };
}

async function main() {
  const people = peoplePath ? readPeople(peoplePath) : [];
  const deals = dealsPath ? readDeals(dealsPath) : [];
  const activities = activitiesPath ? readActivities(activitiesPath) : [];

  const unknownRoutes = Object.keys(ROUTES).filter((title) => deals.length && !deals.some((d) => d.title === title));
  if (unknownRoutes.length) console.warn(`ROUTES entries matching no deal (a title changed?): ${unknownRoutes.join(" | ")}\n`);

  const pool = new Pool({ connectionString });
  const db = await pool.connect();
  const counts = { organizations: 0, contacts: 0, boards: 0, leads: 0, projectCards: 0, issues: 0, people: 0, activities: 0, skipped: 0 };
  try {
    console.log(`${apply ? "APPLYING to" : "Dry run (rolled back) on"} ${host} — ${people.length} people, ${deals.length} deals, ${activities.length} activities\n`);
    await db.query("begin");

    const tenant = await db.query<{ id: string; name: string }>(`select id::text as id, name from public.tenants where slug = $1`, [slug]);
    if (!tenant.rows[0]) throw new Error(`No workspace with slug "${slug}".`);
    const T = tenant.rows[0].id;
    console.log(`Workspace: ${tenant.rows[0].name} (/w/${slug})`);

    const loginId = assigneeEmail
      ? (await db.query<{ id: string }>(`select id::text as id from neon_auth."user" where lower(email) = $1`, [assigneeEmail])).rows[0]?.id ?? null
      : null;
    if (assigneeEmail && !loginId) console.log(`  (no CRM login for ${assigneeEmail} — the assignee is created without one)`);

    // ── Boards: Leads (the app seeds it lazily, so it may not exist yet) and the projects.
    const boards = new Map<"leads" | ProjectKey, { id: string; firstStage: string }>();
    const leadsBoard = (
      await db.query<{ id: string; columns: { id: string }[] }>(
        `select id::text as id, columns from public.pipeline_boards where tenant_id = $1 and is_system order by created_at limit 1`,
        [T]
      )
    ).rows[0];
    if (leadsBoard) boards.set("leads", { id: leadsBoard.id, firstStage: leadsBoard.columns[0]?.id ?? DEFAULT_BOARD_COLUMNS[0].id });
    else {
      const id = randomUUID();
      await insert(db, "pipeline_boards", { id, tenant_id: T, name: DEFAULT_BOARD_NAME, columns: DEFAULT_BOARD_COLUMNS, is_system: true });
      boards.set("leads", { id, firstStage: DEFAULT_BOARD_COLUMNS[0].id });
      counts.boards++;
      console.log(`  + board ${DEFAULT_BOARD_NAME}`);
    }
    const findBoard = finder(db, T, "pipeline_boards", "name", "and not is_system");
    const ensureBoard = async (key: ProjectKey) => {
      const known = boards.get(key);
      if (known) return known;
      const { name, columns } = PROJECTS[key];
      const board = await findBoard(name, async (id) => {
        await insert(db, "pipeline_boards", { id, tenant_id: T, name, columns });
        counts.boards++;
        console.log(`  + project ${name} (${columns.map((c) => c.label).join(" → ")})`);
      });
      // An existing board keeps its own columns: start its cards in whichever column it has first.
      const stored = board.created
        ? columns[0].id
        : (await db.query<{ first: string }>(`select columns->0->>'id' as first from public.pipeline_boards where id = $1`, [board.id])).rows[0]?.first ?? columns[0].id;
      const entry = { id: board.id, firstStage: stored };
      boards.set(key, entry);
      return entry;
    };

    const findOrg = finder(db, T, "organizations", "name");
    const findContact = finder(db, T, "contacts", "name");
    const findPerson = finder(db, T, "team_people", "name", "and archived_at is null");
    const findItem = finder(db, T, "pipeline_items", "title");
    const findIssue = finder(db, T, "traction_issues", "title");

    const ensurePerson = async (name: string) => {
      if (!name) return null;
      const email = KNOWN_EMAILS[name.toLowerCase()] ?? assigneeEmail;
      const person = await findPerson(name, async (id) => {
        await insert(db, "team_people", { id, tenant_id: T, name, email, user_id: loginId });
        counts.people++;
        console.log(`  + team person ${name}${email ? ` <${email}>` : ""}`);
      });
      // An existing person without an email gets it, so the invite still links them.
      if (!person.created && email) {
        await db.query(`update public.team_people set email = $1, updated_at = now() where tenant_id = $2 and id = $3 and email is null`, [email, T, person.id]);
      }
      return person;
    };

    const ensureOrg = async (name: string | undefined) =>
      name
        ? findOrg(name, async (id) => {
            await insert(db, "organizations", { id, tenant_id: T, name });
            counts.organizations++;
            console.log(`  + organization ${name}`);
          })
        : null;

    const ensureContact = async (name: string, details: { email?: string; phone?: string; orgId?: string; orgName?: string }) => {
      if (!name) return null;
      const email = details.email || KNOWN_EMAILS[name.toLowerCase()] || null;
      const phone = details.phone || null;
      const contact = await findContact(name, async (id) => {
        await insert(db, "contacts", { id, tenant_id: T, name, email, phone, organization_id: details.orgId ?? null });
        counts.contacts++;
        console.log(`  + contact ${name}${email ? ` <${email}>` : ""}${phone ? ` ${phone}` : ""}${details.orgName ? ` (${details.orgName})` : ""}`);
      });
      // Fill only what's missing — never overwrite what someone already typed.
      if (!contact.created && (email || phone || details.orgId)) {
        await db.query(
          `update public.contacts set email = coalesce(email, $1), phone = coalesce(phone, $2), organization_id = coalesce(organization_id, $3::uuid), updated_at = now()
            where tenant_id = $4 and id = $5`,
          [email, phone, details.orgId ?? null, T, contact.id]
        );
      }
      return contact;
    };

    const ensureCard = async (board: "leads" | ProjectKey, title: string, details: { contactId?: string; orgId?: string; notes?: string | null }) => {
      const { id: boardId, firstStage } = board === "leads" ? boards.get("leads")! : await ensureBoard(board);
      return findItem(title, async (id) => {
        await insert(db, "pipeline_items", {
          id,
          tenant_id: T,
          board_id: boardId,
          title,
          stage: firstStage,
          contact_id: details.contactId ?? null,
          organization_id: details.orgId ?? null,
          notes: details.notes ?? null,
        });
        if (board === "leads") counts.leads++;
        else counts.projectCards++;
        console.log(`  + ${board === "leads" ? "lead" : `${PROJECTS[board].name} card`}: ${title}`);
      });
    };

    const ensureIssue = async (title: string, details: { issueType: string; notes?: string; personId?: string }) =>
      findIssue(title, async (id) => {
        await insert(db, "traction_issues", {
          id,
          tenant_id: T,
          title,
          notes: details.notes ?? null,
          horizon: "short_term",
          status: "open",
          issue_type: details.issueType,
          raised_by_person_id: details.personId ?? null,
          owner_person_id: details.personId ?? null,
        });
        counts.issues++;
        console.log(`  + issue (${details.issueType}): ${title}`);
      });

    const addActivity = async (a: {
      subject: string;
      due?: string;
      done?: boolean;
      priority?: string;
      notes?: string | null;
      contactId?: string;
      orgId?: string;
      itemId?: string;
      issueId?: string;
      personId?: string;
    }) => {
      const due = phoenixToUtc(a.due ?? "");
      const exists = await db.query(
        `select 1 from public.activities
          where tenant_id = $1 and subject = $2
            and due_date is not distinct from $3::timestamp
            and contact_id is not distinct from $4::uuid
            and pipeline_item_id is not distinct from $5::uuid
            and issue_id is not distinct from $6::uuid
          limit 1`,
        [T, a.subject, due, a.contactId ?? null, a.itemId ?? null, a.issueId ?? null]
      );
      if (exists.rowCount) {
        counts.skipped++;
        return;
      }
      await insert(db, "activities", {
        id: randomUUID(),
        tenant_id: T,
        type: activityType(a.subject),
        subject: a.subject,
        due_date: due,
        done: a.done ?? false,
        priority: a.priority && PRIORITIES.has(a.priority) ? a.priority : null,
        notes: a.notes ?? null,
        contact_id: a.contactId ?? null,
        organization_id: a.orgId ?? null,
        pipeline_item_id: a.itemId ?? null,
        issue_id: a.issueId ?? null,
        assigned_to_person_id: a.personId ?? null,
        created_by_user_id: loginId,
      });
      counts.activities++;
      console.log(`  • ${(a.due ?? "").slice(0, 16).padEnd(16)} ${activityType(a.subject).padEnd(7)} ${a.subject}`);
    };

    // ── 1. People first: they carry the most complete contact details.
    for (const p of people) {
      if (!p.name) continue;
      const org = await ensureOrg(p.organization);
      await ensureContact(p.name, { email: p.email, phone: p.phone, orgId: org?.id, orgName: p.organization });
    }

    // ── 2. Deals, routed. What each one became, for the activities that point at it.
    const dealTargets = new Map<string, { itemId?: string; issueId?: string; orgId?: string }>();
    for (const d of deals) {
      if (!d.title) continue;
      const route = ROUTES[d.title];
      const person = await ensurePerson(d.owner);
      const org = await ensureOrg((route?.kind === "project" && route.org) || d.organization);
      const contact = await ensureContact(d.contact, { orgId: org?.id, orgName: d.organization });

      if (route?.kind === "issue") {
        const issue = await ensureIssue(d.title, { issueType: route.issueType, notes: route.notes, personId: person?.id });
        dealTargets.set(d.title, { issueId: issue.id });
      } else if (route?.kind === "task") {
        await addActivity({ subject: d.title, personId: person?.id });
      } else {
        const card = await ensureCard(route?.kind === "project" ? route.project : "leads", d.title, { contactId: contact?.id, orgId: org?.id, notes: dealNotes(d) });
        dealTargets.set(d.title, { itemId: card.id, orgId: org?.id });
      }
    }

    // ── 3. Activities, linked to whatever their deal became.
    for (const a of activities) {
      if (!a.subject) continue;
      const person = await ensurePerson(a.assignedTo);

      const asIssue = ACTIVITY_AS_ISSUE[a.subject];
      if (asIssue) {
        await ensureIssue(a.subject, { ...asIssue, personId: person?.id });
        continue;
      }

      const org = await ensureOrg(a.organization);
      const contact = await ensureContact(a.contact, { email: a.email, phone: a.phone, orgId: org?.id, orgName: a.organization });
      // A deal missing from the deals export (or none given) still gets its card, as a lead unless ROUTES says otherwise.
      let target = a.deal ? dealTargets.get(a.deal) : undefined;
      if (a.deal && !target) {
        const route = ROUTES[a.deal];
        if (route?.kind === "issue") target = { issueId: (await ensureIssue(a.deal, { issueType: route.issueType, notes: route.notes, personId: person?.id })).id };
        else if (route?.kind !== "task") {
          const card = await ensureCard(route?.kind === "project" ? route.project : "leads", a.deal, { contactId: contact?.id, orgId: org?.id });
          target = { itemId: card.id };
        }
        if (target) dealTargets.set(a.deal, target);
      }

      await addActivity({
        subject: a.subject,
        due: a.due,
        done: a.done,
        priority: a.priority,
        notes: durationNote(a.duration),
        contactId: contact?.id,
        orgId: org?.id ?? target?.orgId,
        itemId: target?.itemId,
        issueId: target?.issueId,
        personId: person?.id,
      });
    }

    console.log(
      `\n${counts.leads} leads, ${counts.projectCards} project cards (${counts.boards} new boards), ${counts.issues} issues, ${counts.activities} activities, ` +
        `${counts.contacts} contacts, ${counts.organizations} organizations, ${counts.people} team people` +
        (counts.skipped ? ` — ${counts.skipped} activities already there, skipped` : "")
    );
    await db.query(apply ? "commit" : "rollback");
    console.log(apply ? "Committed." : "Rolled back (dry run). Re-run with IMPORT_APPLY=yes to write it.");
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
