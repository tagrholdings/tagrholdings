import { Pool } from "pg";
import { TENANT_DATA_TABLES } from "../modules/tenancy/tenancy.constants";

/**
 * Empties a database of everything except its super admin(s): every workspace and all of its data, every other
 * account, sessions, invites, push subscriptions and rate-limit counters. The super admin's own account, login
 * (account + sessions) and `platform_roles` row stay, as does Neon Auth's own config (jwks, project_config).
 *
 * IRREVERSIBLE. Like scripts/migrate-explicit.ts and scripts/grant-super-admin.ts it never reads the repo's env files
 * or `.neon`: you type out which database it touches, and the host must match what you expect. And it only COUNTS
 * what it would delete until you also set WIPE_APPLY=yes.
 *
 * Usage:
 *   WIPE_DATABASE_URL="postgresql://...unpooled-host.../neondb?..." \
 *   WIPE_EXPECT_HOST="ep-your-branch-id" \
 *   [WIPE_APPLY=yes] \
 *   npx tsx scripts/wipe-keep-super-admin.ts
 */
const connectionString = process.env.WIPE_DATABASE_URL;
const expectHost = process.env.WIPE_EXPECT_HOST;
const apply = process.env.WIPE_APPLY === "yes";

if (!connectionString) throw new Error("Set WIPE_DATABASE_URL to the exact connection string to wipe.");
if (!expectHost) throw new Error("Set WIPE_EXPECT_HOST to a substring of the expected database host, as a safety check.");

const host = new URL(connectionString).host;
if (!host.includes(expectHost)) throw new Error(`Refusing to run: host "${host}" does not contain expected "${expectHost}".`);

const COUNTED = [...TENANT_DATA_TABLES, "tenant_members", "tenants", "push_subscriptions", "rate_limit_buckets", "portal_access_requests"] as const;

async function main() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    const keep = await client.query<{ user_id: string; email: string }>(
      `select r.user_id, u.email from public.platform_roles r join neon_auth."user" u on u.id::text = r.user_id`
    );
    if (keep.rows.length === 0) throw new Error(`No super admin on ${host}: refusing to wipe a database that would be left with nobody who can sign in.`);
    const keepIds = keep.rows.map((r) => r.user_id);
    console.log(`${apply ? "WIPING" : "Dry run on"} ${host}\nKeeping super admin(s): ${keep.rows.map((r) => r.email).join(", ")}\n`);

    const counts = async () => {
      const out: Record<string, number> = {};
      for (const table of COUNTED) out[table] = (await client.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
      out["neon_auth.user"] = (await client.query(`select count(*)::int as n from neon_auth."user"`)).rows[0].n;
      return out;
    };

    console.log("Before:", await counts());
    if (!apply) {
      console.log("\nNothing was deleted. Set WIPE_APPLY=yes to apply.");
      return;
    }

    await client.query("begin");
    try {
      for (const table of TENANT_DATA_TABLES) await client.query(`delete from public.${table}`);
      for (const table of ["tenant_members", "tenants", "push_subscriptions", "rate_limit_buckets", "portal_access_requests"]) {
        await client.query(`delete from public.${table}`);
      }
      await client.query(`delete from neon_auth.invitation`);
      await client.query(`delete from neon_auth.member`);
      await client.query(`delete from neon_auth.organization`);
      await client.query(`delete from neon_auth.verification`);
      await client.query(`delete from neon_auth.session where "userId"::text <> all($1::text[])`, [keepIds]);
      await client.query(`delete from neon_auth.account where "userId"::text <> all($1::text[])`, [keepIds]);
      await client.query(`delete from neon_auth."user" where id::text <> all($1::text[])`, [keepIds]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    console.log("\nAfter:", await counts());
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
