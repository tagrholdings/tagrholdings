import { Pool, type PoolClient } from "pg";

/**
 * One-off, for the Grounded workspaces seeded before team people existed (migration 0025): creates a team person for
 * each name on the EOS sheet (Tanner, Jay, Rex, Kody, Grafton — reusing one with the same name if it's already there),
 * turns the Sharisa contact into a teammate too (she works at Grounded), and gives back the owners the sheet named:
 *   - L10 To-Dos noted "L10 owner: <name>" → assigned to that person (the note is cleared);
 *   - the Q2 2026 Rocks and the IDS issues → the owner / raiser from the sheet.
 * Only rows that still have NO owner are touched, so anything set by hand since is left alone. Idempotent.
 *
 * Like the other scripts it never reads env files: you type the database and the host must match. Without
 * ASSIGN_APPLY=yes it runs in a transaction and ROLLS BACK (a dry run).
 *
 * Usage:
 *   ASSIGN_DATABASE_URL="postgresql://..." ASSIGN_EXPECT_HOST="ep-..." [ASSIGN_APPLY=yes] npx tsx scripts/grounded-assign-people.ts
 */
const connectionString = process.env.ASSIGN_DATABASE_URL;
const expectHost = process.env.ASSIGN_EXPECT_HOST;
const apply = process.env.ASSIGN_APPLY === "yes";
if (!connectionString) throw new Error("Set ASSIGN_DATABASE_URL.");
if (!expectHost) throw new Error("Set ASSIGN_EXPECT_HOST to a substring of the expected database host, as a safety check.");
const host = new URL(connectionString).host;
if (!host.includes(expectHost)) throw new Error(`Refusing to run: host "${host}" does not contain expected "${expectHost}".`);

const OWNERS = ["Tanner", "Jay", "Rex", "Kody", "Grafton"];
/** The sheet's Rocks and IDS issues, by title → who owns / raised them. */
const ROCK_OWNERS: Record<string, string> = { "Get 3rd Truck": "Jay", "5 apartment complexes": "Jay", "July $50K": "Rex", "500 customers by July": "Tanner" };
const ISSUE_OWNERS: Record<string, string> = {
  "Home Inspectors is a channel": "Grafton",
  "Work on a switch over process - WHO? From Todos": "Kody",
  "Create a Family/Friends Discount Text to Neighbors, etc": "Rex",
  "Next Quarterly?": "Tanner",
  "Find more home inspectors": "Rex",
};

async function personFor(db: PoolClient, tenantId: string, name: string, email: string | null) {
  const found = await db.query<{ id: string }>(
    `select id from team_people where tenant_id = $1 and archived_at is null and (lower(name) = lower($2) or lower(name) like lower($2) || ' %') order by user_id nulls last limit 1`,
    [tenantId, name]
  );
  if (found.rows[0]) return { id: found.rows[0].id, created: false };
  const inserted = await db.query<{ id: string }>(`insert into team_people (tenant_id, name, email) values ($1, $2, $3) returning id`, [tenantId, name, email]);
  return { id: inserted.rows[0].id, created: true };
}

async function main() {
  const pool = new Pool({ connectionString });
  const db = await pool.connect();
  try {
    console.log(`${apply ? "APPLYING to" : "Dry run (rolled back) on"} ${host}\n`);
    await db.query("begin");
    const tenant = await db.query<{ id: string }>(`select id from tenants where slug = 'grounded'`);
    if (!tenant.rows[0]) throw new Error("No workspace with slug \"grounded\" here.");
    const T = tenant.rows[0].id;

    const ids: Record<string, string> = {};
    for (const name of OWNERS) {
      const { id, created } = await personFor(db, T, name, null);
      ids[name] = id;
      console.log(`  ${name.padEnd(8)} ${created ? "created" : "already on the team"}`);
    }

    // Sharisa is a Grounded employee: she joins the team (the contact stays, history and all).
    const sharisa = await db.query<{ name: string; email: string | null }>(`select name, email from contacts where tenant_id = $1 and name ilike 'Sharisa%' order by created_at limit 1`, [T]);
    if (sharisa.rows[0]) {
      const { created } = await personFor(db, T, sharisa.rows[0].name, sharisa.rows[0].email?.toLowerCase() ?? null);
      console.log(`  ${sharisa.rows[0].name} ${created ? "added to the team (from Contacts)" : "already on the team"}`);
    }

    let todos = 0;
    for (const name of OWNERS) {
      const r = await db.query(
        `update activities set assigned_to_person_id = $1, notes = null, updated_at = now()
         where tenant_id = $2 and l10_todo and assigned_to_person_id is null and assigned_to_contact_id is null and notes = $3`,
        [ids[name], T, `L10 owner: ${name}`]
      );
      todos += r.rowCount ?? 0;
    }
    let rocks = 0;
    for (const [title, name] of Object.entries(ROCK_OWNERS)) {
      const r = await db.query(`update traction_rocks set owner_person_id = $1, updated_at = now() where tenant_id = $2 and title = $3 and owner_person_id is null`, [ids[name], T, title]);
      rocks += r.rowCount ?? 0;
    }
    let issues = 0;
    for (const [title, name] of Object.entries(ISSUE_OWNERS)) {
      const r = await db.query(
        `update traction_issues set owner_person_id = coalesce(owner_person_id, $1), raised_by_person_id = coalesce(raised_by_person_id, $1), updated_at = now()
         where tenant_id = $2 and title = $3 and (owner_person_id is null or raised_by_person_id is null)`,
        [ids[name], T, title]
      );
      issues += r.rowCount ?? 0;
    }
    console.log(`\nOwners given back: ${todos} To-Dos, ${rocks} Rocks, ${issues} issues`);

    await db.query(apply ? "commit" : "rollback");
    console.log(apply ? "Committed." : "Rolled back — nothing was written. Set ASSIGN_APPLY=yes to write.");
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
