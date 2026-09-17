import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Precedence: an explicit shell env var wins, then .env.local (development
// branch), then .env (production) — so `npm run db:migrate` targets dev by
// default, and a production migration needs an explicit
// DATABASE_URL_UNPOOLED shell override.
//
// dotenv's default config() never overwrites a key already in process.env,
// so loading narrowest-first and never passing `override: true` gives that
// exact precedence — a `{ override: true }` on the second call would also
// clobber a shell-set value, not just the one from `.env` (verified the
// hard way: 2026-09-17, a production seed ran against the dev database
// despite an explicit shell override).
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./modules/*/*.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Direct (non-pooled) connection — required for migrations.
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
