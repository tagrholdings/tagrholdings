/**
 * One-off bootstrap for an account. There's no public sign-up page by
 * design (see AGENTS.md/checklist — internal, admin-created users only), so
 * this hits the sign-up endpoint directly against a running dev server,
 * then links the created user to the "Tagr Holdings" tenant.
 *
 * Sign-ups are DISABLED in Neon Auth on both branches (anyone could
 * otherwise register through /api/auth/sign-up/email). To create a user,
 * open sign-ups on the target branch only for the duration of this script:
 *   neon neon-auth config email-password update --branch development --disable-sign-up false
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... SEED_ADMIN_NAME="..." npx tsx scripts/seed.ts
 *   neon neon-auth config email-password update --branch development --disable-sign-up true
 *
 * Usage (dev server must be running in another terminal):
 *   SEED_ADMIN_EMAIL=you@tagrholdings.com SEED_ADMIN_PASSWORD=... SEED_ADMIN_NAME="Tanner" npx tsx scripts/seed.ts
 *
 * Safe to re-run: the tenant upsert and the tenant_members link are both
 * idempotent. Re-running with an email that already has an account fails at
 * the sign-up step (expected — Better Auth rejects duplicate emails); in
 * that case link an existing user id directly with SEED_ADMIN_USER_ID
 * instead of SEED_ADMIN_EMAIL/PASSWORD.
 */
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { tenantsTable, tenantMembersTable } from "../modules/tenancy/tenancy.schema";

// Same precedence as drizzle.config.ts — see the comment there. Load
// narrowest-first and never pass `override: true`, so a shell-set env var
// always wins over both files instead of being silently clobbered.
config({ path: ".env.local" });
config({ path: ".env" });

const APP_URL = process.env.SEED_APP_URL ?? "http://localhost:3000";
const TENANT_NAME = "Tagr Holdings";
const TENANT_SLUG = "tagr-holdings";

async function resolveUserId(): Promise<string> {
  if (process.env.SEED_ADMIN_USER_ID) {
    return process.env.SEED_ADMIN_USER_ID;
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME;

  if (!email || !password || !name) {
    throw new Error(
      "Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, and SEED_ADMIN_NAME (or SEED_ADMIN_USER_ID for an already-created account). See the usage comment at the top of this file."
    );
  }

  const response = await fetch(`${APP_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `Sign-up failed (${response.status}): ${body?.message ?? JSON.stringify(body)}. Is \`npm run dev\` running at ${APP_URL}, and are sign-ups temporarily enabled (see the comment at the top of this file)?`
    );
  }

  return body.user.id as string;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool, { schema: { tenantsTable, tenantMembersTable } });

  try {
    const existingTenant = await db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.slug, TENANT_SLUG),
    });
    const tenantId =
      existingTenant?.id ??
      (
        await db
          .insert(tenantsTable)
          .values({ name: TENANT_NAME, slug: TENANT_SLUG })
          .returning({ id: tenantsTable.id })
      )[0].id;

    const userId = await resolveUserId();

    await db.insert(tenantMembersTable).values({ tenantId, userId }).onConflictDoNothing();

    console.log(`Linked user ${userId} to tenant "${TENANT_NAME}" (${tenantId}).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
