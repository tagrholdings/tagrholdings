import { randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

/**
 * Creates the "Grounded Pest Control" workspace from Grounded's EOS spreadsheet (V/TO, Leadership L10, Scorecard),
 * importing only what the sheet actually says:
 *   - CRM: the L10 To-Do list → activities marked as L10 To-Dos (struck-through rows are done); Bullseye Mgmt / Nick
 *     Stratton and Sharisa → organizations/contacts.
 *   - Traction: the Scorecard's measurables and the values it has (May–Sep 2026, monthly); the L10 sheet's Rocks
 *     (Q2 2026, with their statuses); its IDS list → Issues (struck-through = solved); the V/TO's filled-in fields.
 * Left out on purpose: the V/TO's "Rocks for the Quarter" (dated "3/31/25", no status — ambiguous), and goals the
 * sheet doesn't give (only revenue has one: $13,500).
 *
 * Owners ("Who") are CRM accounts. Pass the ones that already exist in GROUNDED_OWNER_EMAILS: they become members and
 * own their rows. An owner without an account leaves their rows unowned — a To-Do gets "L10 owner: <name>" in its notes.
 *
 * Like scripts/migrate-explicit.ts it never reads the repo's env files or `.neon`: you type the database and the host
 * must match. It refuses to run if the `grounded` slug already exists. Without GROUNDED_APPLY=yes it runs everything
 * inside a transaction and ROLLS BACK (a dry run that still checks every constraint). Needs migrations 0023-0024.
 *
 * Usage:
 *   SEED_DATABASE_URL="postgresql://...unpooled-host.../neondb?..." \
 *   SEED_EXPECT_HOST="ep-your-branch-id" \
 *   GROUNDED_ADMIN_EMAIL="someone@example.com" \
 *   GROUNDED_OWNER_EMAILS="Tanner=tanner@example.com,Jay=jay@example.com,Rex=...,Kody=...,Grafton=..." \
 *   [GROUNDED_APPLY=yes] \
 *   npx tsx scripts/seed-grounded.ts
 */
const connectionString = process.env.SEED_DATABASE_URL;
const expectHost = process.env.SEED_EXPECT_HOST;
const apply = process.env.GROUNDED_APPLY === "yes";
if (!connectionString) throw new Error("Set SEED_DATABASE_URL to the exact connection string to write to.");
if (!expectHost) throw new Error("Set SEED_EXPECT_HOST to a substring of the expected database host, as a safety check.");
const host = new URL(connectionString).host;
if (!host.includes(expectHost)) throw new Error(`Refusing to run: host "${host}" does not contain expected "${expectHost}".`);

const WORKSPACE_NAME = "Grounded Pest Control";
const WORKSPACE_SLUG = "grounded";

const OWNERS = ["Tanner", "Jay", "Rex", "Kody", "Grafton"] as const;
type Owner = (typeof OWNERS)[number];

/** "Tanner=a@b.com,Jay=c@d.com" → { Tanner: "a@b.com", Jay: "c@d.com" }. Unknown names are an error, not ignored. */
function parseOwnerEmails(raw: string | undefined): Partial<Record<Owner, string>> {
  const out: Partial<Record<Owner, string>> = {};
  for (const pair of (raw ?? "").split(",").map((p) => p.trim()).filter(Boolean)) {
    const [name, email] = pair.split("=").map((s) => s.trim());
    if (!OWNERS.includes(name as Owner) || !email) throw new Error(`GROUNDED_OWNER_EMAILS: bad entry "${pair}" (names: ${OWNERS.join(", ")}).`);
    out[name as Owner] = email.toLowerCase();
  }
  return out;
}
const ownerEmails = parseOwnerEmails(process.env.GROUNDED_OWNER_EMAILS);
const adminEmail = process.env.GROUNDED_ADMIN_EMAIL?.trim().toLowerCase() || null;

/** Arizona has no DST — always UTC-7. */
const phoenix = (isoDate: string, hour: number) => new Date(`${isoDate}T${String(hour).padStart(2, "0")}:00:00-07:00`);

type Row = Record<string, unknown>;
const prepared = (v: unknown) => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);
async function insert(db: PoolClient, table: string, row: Row) {
  const keys = Object.keys(row);
  await db.query(`insert into public.${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`, keys.map((k) => prepared(row[k])));
}

// ───────────────────────────── CRM: the L10 To-Do list ─────────────────────────────

const ORGANIZATIONS = [{ key: "bullseye", name: "Bullseye Mgmt", notes: "Property management. Contact: Nick Stratton." }];

const CONTACTS = [
  { key: "nick", name: "Nick Stratton", org: "bullseye" as string | null },
  { key: "sharisa", name: "Sharisa", org: null },
];

interface Todo {
  subject: string;
  who: Owner;
  type?: "task" | "meeting";
  done?: boolean;
  due?: Date;
  contact?: string;
  org?: string;
}

// In sheet order. `done` = struck through on the sheet. Green-highlighted rows (Send Insurance Waiver, Talk to Jay
// about Call Center) are not struck, so they stay open.
const TODOS: Todo[] = [
  { subject: "Send Insurance Waiver", who: "Jay" },
  { subject: "Assign Unified to Grounded", who: "Kody" },
  { subject: "Field Routes Consultant", who: "Tanner", done: true },
  { subject: "Create a Scorecard", who: "Tanner", done: true },
  { subject: "Marketing to Home Inspectors/Realtors (Events)", who: "Grafton" },
  { subject: "Hire another photographer (Breschia)", who: "Tanner" },
  { subject: "Talk to Jay about Call Center person for Grounded", who: "Tanner" },
  { subject: "Buy new Truck", who: "Tanner", done: true },
  { subject: "Dialpad on Rex's phone", who: "Kody" },
  { subject: "Tenant contacts to Rex for managed properties", who: "Kody" },
  { subject: "Coordinate Meeting w/ Bullseye Mgmt (Nick Stratton)", who: "Grafton", type: "meeting", done: true, contact: "nick", org: "bullseye" },
  { subject: "MR Fall Festival (Oct 16) - Sharisa", who: "Rex", type: "meeting", due: phoenix("2026-10-16", 9), contact: "sharisa" },
  { subject: "Never Lose a customer", who: "Tanner" },
  { subject: "SWAG for Managers - What's a great thank you?", who: "Rex" },
  { subject: "Create a list of Home Inspectors", who: "Tanner" },
  { subject: "SWAG for BIG partners", who: "Tanner" },
  { subject: "Social Media", who: "Tanner" },
];

// ───────────────────────────── Traction ─────────────────────────────

const MONTHS = ["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"];

/** The Scorecard sheet's rows. `values` line up with MONTHS (May–Sep); null = the sheet's cell is empty. Its "Who" column is empty. */
const MEASURABLES: { name: string; unit: string; aggregation: string; goal?: number; values: (number | null)[] }[] = [
  { name: "Monthly Revenue (FieldRoutes)", unit: "currency", aggregation: "sum", goal: 13500, values: [14682.5, 19050.5, 22766.5, 27914.5, null] },
  { name: "Monthly P&L", unit: "currency", aggregation: "sum", values: [14926.0, 22991.88, 17241.27, 22478.73, null] },
  { name: "New Customers", unit: "number", aggregation: "sum", values: [] },
  { name: "Call backs", unit: "number", aggregation: "sum", values: [] },
  { name: "Referrals", unit: "number", aggregation: "sum", values: [] },
  { name: "Active Customers", unit: "number", aggregation: "latest", values: [301, 340, 378, 396, 421] },
  { name: "Aging AR", unit: "currency", aggregation: "latest", values: [] },
];

/** The L10 sheet's Rocks (due 6/30/26 → Q2 2026), with their statuses. */
const ROCKS: { title: string; owner: Owner; status: string; criteria?: string }[] = [
  { title: "Get 3rd Truck", owner: "Jay", status: "complete" },
  { title: "5 apartment complexes", owner: "Jay", status: "complete", criteria: "Rex/Jay schedule a drop off together." },
  { title: "July $50K", owner: "Rex", status: "off_track" },
  { title: "500 customers by July", owner: "Tanner", status: "off_track" },
];

/** The L10 sheet's "60 Min IDS" list. Struck through = solved. */
const ISSUES: { title: string; creator: Owner; solved?: boolean }[] = [
  { title: "Home Inspectors is a channel", creator: "Grafton" },
  { title: "Work on a switch over process - WHO? From Todos", creator: "Kody" },
  { title: "Create a Family/Friends Discount Text to Neighbors, etc", creator: "Rex" },
  { title: "Next Quarterly?", creator: "Tanner", solved: true },
  { title: "Find more home inspectors", creator: "Rex", solved: true },
];

/** The V/TO sheet — only the fields it fills in; the rest stay empty (the page shows them as gaps). */
const VTO = {
  coreValues: [],
  purpose: "",
  niche: "Grounded In Trust",
  tenYear: { date: "Jan 30, 2036", revenue: "$20M", picture: "60–70 techs, multiple markets" },
  marketing: { targetMarket: "", uniques: [], provenProcess: "Onboarding", guarantee: "" },
  threeYear: { date: "Jan 30, 2029", revenue: "$3M", profit: "", measurables: "", picture: ["8–10 trucks", "Office", "Team / staff"] },
  oneYear: { date: "Jan 30, 2027", revenue: "$600K", profit: "", measurables: "", goals: ["4–5 trucks", "Conex"] },
};

// ───────────────────────────── Run ─────────────────────────────

async function findUserIdsByEmail(db: PoolClient, emails: string[]) {
  if (emails.length === 0) return new Map<string, string>();
  const { rows } = await db.query<{ id: string; email: string }>(
    `select id::text as id, lower(email) as email from neon_auth."user" where lower(email) = any($1)`,
    [emails]
  );
  return new Map(rows.map((r) => [r.email, r.id]));
}

async function main() {
  const pool = new Pool({ connectionString });
  const db = await pool.connect();
  try {
    console.log(`${apply ? "APPLYING to" : "Dry run (rolled back) on"} ${host}\n`);
    await db.query("begin");

    const taken = await db.query(`select 1 from public.tenants where slug = $1`, [WORKSPACE_SLUG]);
    if (taken.rowCount) throw new Error(`A workspace with slug "${WORKSPACE_SLUG}" already exists — refusing to import twice.`);

    const usersByEmail = await findUserIdsByEmail(db, [...Object.values(ownerEmails), ...(adminEmail ? [adminEmail] : [])]);
    if (adminEmail && !usersByEmail.has(adminEmail)) throw new Error(`GROUNDED_ADMIN_EMAIL ${adminEmail} has no CRM account.`);

    const T = randomUUID();
    await insert(db, "tenants", { id: T, name: WORKSPACE_NAME, slug: WORKSPACE_SLUG, inbound_local_part: `${WORKSPACE_SLUG}-${randomBytes(5).toString("hex")}` });
    console.log(`Workspace: ${WORKSPACE_NAME} (/w/${WORKSPACE_SLUG})`);

    // Members: the admin, plus every owner who already has an account.
    const memberRoles = new Map<string, "admin" | "member">();
    if (adminEmail) memberRoles.set(usersByEmail.get(adminEmail)!, "admin");
    const ownerId: Partial<Record<Owner, string>> = {};
    for (const owner of OWNERS) {
      const email = ownerEmails[owner];
      const userId = email ? usersByEmail.get(email) : undefined;
      if (userId) {
        ownerId[owner] = userId;
        if (!memberRoles.has(userId)) memberRoles.set(userId, "member");
      }
      console.log(`  ${owner.padEnd(8)} ${userId ? `→ ${email}` : email ? `✗ ${email} has no account — left unowned` : "✗ no email given — left unowned"}`);
    }
    for (const [userId, role] of memberRoles) await insert(db, "tenant_members", { tenant_id: T, user_id: userId, role });
    console.log(`Members: ${memberRoles.size}${memberRoles.size === 0 ? " (only a super admin can open it until someone is invited)" : ""}`);
    const owner = (name: Owner) => ownerId[name] ?? null;

    // CRM
    const orgId: Record<string, string> = {};
    for (const o of ORGANIZATIONS) {
      orgId[o.key] = randomUUID();
      await insert(db, "organizations", { id: orgId[o.key], tenant_id: T, name: o.name, notes: o.notes });
    }
    const contactId: Record<string, string> = {};
    for (const c of CONTACTS) {
      contactId[c.key] = randomUUID();
      await insert(db, "contacts", { id: contactId[c.key], tenant_id: T, name: c.name, organization_id: c.org ? orgId[c.org] : null });
    }
    for (const t of TODOS) {
      await insert(db, "activities", {
        tenant_id: T,
        type: t.type ?? "task",
        subject: t.subject,
        due_date: t.due ?? null,
        done: t.done ?? false,
        notes: owner(t.who) ? null : `L10 owner: ${t.who}`,
        contact_id: t.contact ? contactId[t.contact] : null,
        organization_id: t.org ? orgId[t.org] : null,
        assigned_to_user_id: owner(t.who),
        l10_todo: true,
      });
    }
    const open = TODOS.filter((t) => !t.done).length;
    console.log(`CRM: ${ORGANIZATIONS.length} organization, ${CONTACTS.length} contacts, ${TODOS.length} L10 To-Dos (${open} open)`);

    // Traction — Scorecard
    let entries = 0;
    for (const [i, m] of MEASURABLES.entries()) {
      const id = randomUUID();
      await insert(db, "traction_measurables", {
        id,
        tenant_id: T,
        name: m.name,
        cadence: "monthly",
        unit: m.unit,
        aggregation: m.aggregation,
        goal_operator: m.goal === undefined ? null : "gte",
        goal_value: m.goal ?? null,
        sort_order: i,
      });
      for (const [k, value] of m.values.entries()) {
        if (value === null) continue;
        await insert(db, "traction_entries", { tenant_id: T, measurable_id: id, period_start: MONTHS[k], value });
        entries++;
      }
    }
    console.log(`Scorecard: ${MEASURABLES.length} measurables, ${entries} values`);

    // Traction — Rocks
    for (const r of ROCKS) {
      await insert(db, "traction_rocks", { tenant_id: T, quarter: "2026-Q2", title: r.title, owner_user_id: owner(r.owner), due_date: "2026-06-30", status: r.status, success_criteria: r.criteria ?? null });
    }
    console.log(`Rocks: ${ROCKS.length} (Q2 2026)`);

    // Traction — Issues
    for (const [i, issue] of ISSUES.entries()) {
      await insert(db, "traction_issues", {
        tenant_id: T,
        title: issue.title,
        horizon: "short_term",
        status: issue.solved ? "solved" : "open",
        rank: issue.solved ? null : i + 1,
        raised_by_user_id: owner(issue.creator),
        owner_user_id: owner(issue.creator),
        solved_at: issue.solved ? new Date() : null,
      });
    }
    console.log(`Issues: ${ISSUES.length} (${ISSUES.filter((i) => !i.solved).length} open)`);

    // Traction — V/TO
    await insert(db, "traction_vto", { tenant_id: T, content: VTO });
    console.log("V/TO: saved");

    await db.query(apply ? "commit" : "rollback");
    console.log(apply ? "\nCommitted." : "\nRolled back — nothing was written. Set GROUNDED_APPLY=yes to write.");
  } catch (err) {
    await db.query("rollback").catch(() => {});
    throw err;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
