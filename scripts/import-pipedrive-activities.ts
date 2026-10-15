import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { DEFAULT_BOARD_COLUMNS, DEFAULT_BOARD_NAME } from "../modules/pipeline/pipeline.constants";

/**
 * Imports a Pipedrive "Activities" CSV export into an EXISTING workspace (default: tagr-holdings):
 *   - "Activity - Organization"          → organizations (found by name, else created)
 *   - "Activity - Contact person" + email/phone columns → contacts (found by name, else created; the assignee's own
 *     name is not a contact — Pipedrive puts the owner there on internal to-dos)
 *   - "Activity - Deal"                  → a card on the workspace's Leads board, first stage (found by title, else created)
 *   - each row                           → an activity, assigned to the team person named in "Activity - Assigned to user"
 *     (found by name, else created — linked to the CRM login with IMPORT_ASSIGNEE_EMAIL when given)
 * Type is read from the subject: "Call…" → call, lunch/meeting/committee → meeting, anything else → task.
 * "Activity - Duration" goes into the notes (activities have no duration). Dates are Phoenix time (UTC-7, no DST);
 * a date without a time is stored as local midnight — what the app's own date-only picker stores.
 *
 * Re-runnable: an activity with the same subject, due date, contact and deal already in the workspace is skipped.
 *
 * Like scripts/migrate-explicit.ts it never reads the repo's env files or `.neon`: you type the database and the host
 * must match. Without IMPORT_APPLY=yes everything runs in a transaction that is ROLLED BACK (a dry run that still
 * checks every constraint) and prints what it would do.
 *
 * Usage:
 *   SEED_DATABASE_URL="postgresql://...unpooled-host.../neondb?..." \
 *   SEED_EXPECT_HOST="ep-your-branch-id" \
 *   IMPORT_CSV="C:/path/activities.csv" \
 *   [IMPORT_WORKSPACE_SLUG="tagr-holdings"] \
 *   [IMPORT_ASSIGNEE_EMAIL="tanner@example.com"] \
 *   [IMPORT_APPLY=yes] \
 *   npx tsx scripts/import-pipedrive-activities.ts
 */
const connectionString = process.env.SEED_DATABASE_URL;
const expectHost = process.env.SEED_EXPECT_HOST;
const csvPath = process.env.IMPORT_CSV;
const slug = process.env.IMPORT_WORKSPACE_SLUG?.trim() || "tagr-holdings";
const assigneeEmail = process.env.IMPORT_ASSIGNEE_EMAIL?.trim().toLowerCase() || null;
const apply = process.env.IMPORT_APPLY === "yes";
if (!connectionString) throw new Error("Set SEED_DATABASE_URL to the exact connection string to write to.");
if (!expectHost) throw new Error("Set SEED_EXPECT_HOST to a substring of the expected database host, as a safety check.");
if (!csvPath) throw new Error("Set IMPORT_CSV to the path of the Pipedrive activities export.");
const host = new URL(connectionString).host;
if (!host.includes(expectHost)) throw new Error(`Refusing to run: host "${host}" does not contain expected "${expectHost}".`);

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
  const [header, ...rows] = parseCsv(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`The CSV has no "${name}" column — is this a Pipedrive activities export?`);
    return (row: string[]) => (row[index] ?? "").trim();
  };
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
  const first = (getters: ((row: string[]) => string)[], row: string[]) => getters.map((g) => g(row)).find(Boolean) ?? "";

  return rows.map((row) => ({
    done: done(row).toLowerCase() === "done",
    subject: subject(row),
    deal: deal(row),
    due: due(row),
    priority: priority(row).toLowerCase(),
    contact: contact(row),
    email: first(emails, row),
    phone: first(phones, row),
    organization: org(row),
    duration: duration(row),
    assignedTo: assigned(row),
  }));
}

function activityType(subject: string): "call" | "meeting" | "task" {
  if (/^call\b/i.test(subject)) return "call";
  if (/\b(lunch|meeting|committ)/i.test(subject)) return "meeting";
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

/** "01:00" → "1h", "00:30" → "30 min". */
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
  const activities = readActivities(csvPath!);
  const pool = new Pool({ connectionString });
  const db = await pool.connect();
  const counts = { organizations: 0, contacts: 0, deals: 0, people: 0, activities: 0, skipped: 0 };
  try {
    console.log(`${apply ? "APPLYING to" : "Dry run (rolled back) on"} ${host} — ${activities.length} rows from ${csvPath}\n`);
    await db.query("begin");

    const tenant = await db.query<{ id: string; name: string }>(`select id::text as id, name from public.tenants where slug = $1`, [slug]);
    if (!tenant.rows[0]) throw new Error(`No workspace with slug "${slug}".`);
    const T = tenant.rows[0].id;
    console.log(`Workspace: ${tenant.rows[0].name} (/w/${slug})`);

    // The Leads board — the app seeds it lazily on first visit, so it may not exist yet.
    let board = (
      await db.query<{ id: string; columns: { id: string }[] }>(
        `select id::text as id, columns from public.pipeline_boards where tenant_id = $1 and is_system order by created_at limit 1`,
        [T]
      )
    ).rows[0];
    if (!board) {
      board = { id: randomUUID(), columns: DEFAULT_BOARD_COLUMNS };
      await insert(db, "pipeline_boards", { id: board.id, tenant_id: T, name: DEFAULT_BOARD_NAME, columns: DEFAULT_BOARD_COLUMNS, is_system: true });
      console.log(`Created the ${DEFAULT_BOARD_NAME} board`);
    }
    const firstStage = board.columns[0]?.id ?? "sourced";

    const loginId = assigneeEmail
      ? (await db.query<{ id: string }>(`select id::text as id from neon_auth."user" where lower(email) = $1`, [assigneeEmail])).rows[0]?.id ?? null
      : null;
    if (assigneeEmail && !loginId) console.log(`  (no CRM login for ${assigneeEmail} — the assignee is created without one)`);

    const findOrg = finder(db, T, "organizations", "name");
    const findContact = finder(db, T, "contacts", "name");
    const findPerson = finder(db, T, "team_people", "name", "and archived_at is null");
    const findDeal = finder(db, T, "pipeline_items", "title", "and board_id = $3", [board.id]);

    for (const a of activities) {
      if (!a.subject) continue;

      const person = a.assignedTo
        ? await findPerson(a.assignedTo, async (id) => {
            await insert(db, "team_people", { id, tenant_id: T, name: a.assignedTo, email: assigneeEmail, user_id: loginId });
            counts.people++;
            console.log(`  + team person ${a.assignedTo}`);
          })
        : null;

      const org = a.organization
        ? await findOrg(a.organization, async (id) => {
            await insert(db, "organizations", { id, tenant_id: T, name: a.organization });
            counts.organizations++;
            console.log(`  + organization ${a.organization}`);
          })
        : null;

      // On internal to-dos Pipedrive lists the owner as the contact — that is not someone to keep in Contacts.
      const isSelf = !!a.contact && a.contact.toLowerCase() === a.assignedTo.toLowerCase();
      const contact =
        a.contact && !isSelf
          ? await findContact(a.contact, async (id) => {
              await insert(db, "contacts", { id, tenant_id: T, name: a.contact, email: a.email || null, phone: a.phone || null, organization_id: org?.id ?? null });
              counts.contacts++;
              console.log(`  + contact ${a.contact}${org ? ` (${a.organization})` : ""}`);
            })
          : null;

      const deal = a.deal
        ? await findDeal(a.deal, async (id) => {
            await insert(db, "pipeline_items", {
              id,
              tenant_id: T,
              board_id: board.id,
              title: a.deal,
              stage: firstStage,
              contact_id: contact?.id ?? null,
              organization_id: org?.id ?? null,
            });
            counts.deals++;
            console.log(`  + lead ${a.deal}`);
          })
        : null;

      const due = phoenixToUtc(a.due);
      const exists = await db.query(
        `select 1 from public.activities
          where tenant_id = $1 and subject = $2
            and due_date is not distinct from $3::timestamp
            and contact_id is not distinct from $4::uuid
            and pipeline_item_id is not distinct from $5::uuid
          limit 1`,
        [T, a.subject, due, contact?.id ?? null, deal?.id ?? null]
      );
      if (exists.rowCount) {
        counts.skipped++;
        continue;
      }

      await insert(db, "activities", {
        id: randomUUID(),
        tenant_id: T,
        type: activityType(a.subject),
        subject: a.subject,
        due_date: due,
        done: a.done,
        priority: PRIORITIES.has(a.priority) ? a.priority : null,
        notes: durationNote(a.duration),
        contact_id: contact?.id ?? null,
        organization_id: org?.id ?? null,
        pipeline_item_id: deal?.id ?? null,
        assigned_to_person_id: person?.id ?? null,
        created_by_user_id: loginId,
      });
      counts.activities++;
      console.log(`  • ${a.due.slice(0, 16).padEnd(16)} ${activityType(a.subject).padEnd(7)} ${a.subject}`);
    }

    console.log(
      `\n${counts.activities} activities, ${counts.deals} leads, ${counts.contacts} contacts, ${counts.organizations} organizations, ${counts.people} team people` +
        (counts.skipped ? ` — ${counts.skipped} already there, skipped` : "")
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
