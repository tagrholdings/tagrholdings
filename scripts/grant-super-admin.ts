import { Pool } from "pg";

/**
 * Makes an existing account a PLATFORM super admin (can create workspaces and open any of them). This script is the
 * ONLY way to grant it — there is deliberately no screen or action that writes `platform_roles`, so a super admin can
 * only come from someone with direct access to the database (and to this repo).
 *
 * The account must already exist (create it with scripts/seed.ts or accept an invite first).
 *
 * Like scripts/migrate-explicit.ts, it never reads the repo's env files or `.neon`: you type out which database it
 * touches, and the host must match what you expect.
 *
 * Usage:
 *   GRANT_DATABASE_URL="postgresql://...host.../neondb?..." \
 *   GRANT_EXPECT_HOST="ep-your-branch-id" \
 *   npx tsx scripts/grant-super-admin.ts someone@tagrholdings.com
 *
 * Revoking is a manual `delete from platform_roles where user_id = '…'` — also deliberately not an app feature.
 */
const connectionString = process.env.GRANT_DATABASE_URL;
const expectHost = process.env.GRANT_EXPECT_HOST;
const email = process.argv[2]?.trim().toLowerCase();

if (!connectionString) throw new Error("Set GRANT_DATABASE_URL to the exact connection string to use.");
if (!expectHost) throw new Error("Set GRANT_EXPECT_HOST to a substring of the expected database host, as a safety check.");
if (!email) throw new Error("Pass the account's email: npx tsx scripts/grant-super-admin.ts someone@example.com");

const host = new URL(connectionString).host;
if (!host.includes(expectHost)) {
  throw new Error(`Refusing to run: host "${host}" does not contain expected "${expectHost}".`);
}

async function main() {
  const pool = new Pool({ connectionString });
  try {
    const found = await pool.query<{ id: string }>(`select id::text as id from neon_auth."user" where lower(email) = $1`, [email]);
    if (found.rows.length === 0) throw new Error(`No account with email ${email} on ${host}.`);
    const userId = found.rows[0].id;

    await pool.query(
      `insert into platform_roles (user_id, role) values ($1, 'super_admin') on conflict (user_id) do update set role = excluded.role`,
      [userId]
    );
    console.log(`${email} (${userId}) is now a super admin on ${host}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
