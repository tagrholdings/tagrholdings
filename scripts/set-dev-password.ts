import { randomBytes } from "node:crypto";
import { Pool } from "pg";

/**
 * Sets a new password for one account on the DEVELOPMENT branch only, the same way the app's invite flow does
 * (modules/auth-accounts): store a one-time reset token in Neon Auth's verification table, then let Neon Auth's own
 * /reset-password endpoint hash and save the password. We never hash it ourselves.
 * Refuses any database or auth host that isn't ep-blue-flower (dev). Production is never touched.
 *
 * Usage (from the repo root):
 *   DEV_DATABASE_URL="postgresql://...ep-blue-flower..." DEV_AUTH_URL="https://ep-blue-flower....neonauth.../auth" \
 *   EMAIL="admin@tagrholdings.com" NEW_PASSWORD="..." npx tsx scripts/set-dev-password.ts
 */
const dbUrl = process.env.DEV_DATABASE_URL;
const authUrl = process.env.DEV_AUTH_URL?.replace(/\/+$/, "");
const email = process.env.EMAIL?.toLowerCase();
const password = process.env.NEW_PASSWORD;
const origin = process.env.ORIGIN ?? "http://localhost:3000";
if (!dbUrl || !authUrl || !email || !password) throw new Error("Set DEV_DATABASE_URL, DEV_AUTH_URL, EMAIL and NEW_PASSWORD.");
for (const url of [dbUrl, authUrl]) {
  if (!new URL(url).host.includes("ep-blue-flower")) throw new Error(`Refusing: ${new URL(url).host} is not the dev branch.`);
}

async function main() {
  const pool = new Pool({ connectionString: dbUrl });
  const token = randomBytes(24).toString("base64url");
  try {
    const user = await pool.query<{ id: string }>(`select id::text as id from neon_auth."user" where lower(email) = $1`, [email]);
    if (user.rowCount !== 1) throw new Error(`No account for ${email}.`);
    await pool.query(
      `insert into neon_auth.verification (identifier, value, "expiresAt") values ($1, $2, now() + interval '10 minutes')`,
      [`reset-password:${token}`, user.rows[0].id]
    );
    const response = await fetch(`${authUrl!}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ newPassword: password, token }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Neon Auth refused (${response.status}): ${body.slice(0, 300)}`);
    console.log(`Password updated for ${email} through Neon Auth (${new URL(authUrl!).host}).`);
  } finally {
    // Single-use: Neon Auth deletes it on success; this cleans up after a failure.
    await pool.query(`delete from neon_auth.verification where identifier = $1`, [`reset-password:${token}`]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
