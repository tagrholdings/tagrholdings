import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Runs pending drizzle/ migrations against an explicit connection string,
 * bypassing `drizzle-kit migrate` entirely. `drizzle-kit` auto-detects a
 * linked Neon project via the repo-root `.neon` file and injects THAT
 * branch's credentials, overriding whatever DATABASE_URL_UNPOOLED is set in
 * .env/.env.local/the shell — this previously sent a migration to
 * production while every env var and `.neon` said "development"
 * (see drizzle.config.ts's history for the full story). This script never
 * touches drizzle-kit or `.neon`, so that override path doesn't exist here.
 *
 * Usage:
 *   MIGRATE_DATABASE_URL="postgresql://...unpooled-host.../neondb?..." \
 *   MIGRATE_EXPECT_HOST="ep-your-branch-id" \
 *   npx tsx scripts/migrate-explicit.ts
 *
 * MIGRATE_EXPECT_HOST is a required substring match against the connection
 * string's host — a deliberate, typed-out confirmation of which database
 * you're about to alter, not read from any config file.
 */
const connectionString = process.env.MIGRATE_DATABASE_URL;
const expectHost = process.env.MIGRATE_EXPECT_HOST;

if (!connectionString) {
  throw new Error("Set MIGRATE_DATABASE_URL to the exact (unpooled) connection string to migrate.");
}
if (!expectHost) {
  throw new Error("Set MIGRATE_EXPECT_HOST to a substring of the expected database host, as a safety check.");
}

const host = new URL(connectionString).host;
if (!host.includes(expectHost)) {
  throw new Error(`Refusing to migrate: host "${host}" does not contain expected "${expectHost}".`);
}

async function main() {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  console.log(`Migrating ${host} ...`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
