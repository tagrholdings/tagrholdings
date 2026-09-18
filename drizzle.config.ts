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
//
// ⚠️ CORRECTION (2026-09-18): the above is necessary but NOT sufficient.
// `drizzle-kit` also auto-detects a linked Neon project via the `.neon`
// file at the repo root and injects ITS linked branch's credentials —
// this wins over everything above, including a shell-exported
// DATABASE_URL_UNPOOLED, because it isn't part of this dotenv precedence
// chain at all. Verified the hard way again: `.neon` was linked to
// `production` (`neon link`'s default target branch) and `npm run
// db:migrate` silently applied a migration to production while this file
// and every env var said "development". The `.neon` file's `branch` field
// is the actual source of truth for which database `db:generate`/
// `db:migrate`/`db:studio` hit — check `neon branches list` (the
// `[current]` row) or `cat .neon` before running any of them, and
// `neon checkout development` / `neon checkout production` to switch it
// (this also overwrites `.env` with that branch's Neon-managed vars —
// non-Neon keys like RESEND_API_KEY are preserved, but if you checkout
// development you must `neon checkout production` back afterward or the
// next deploy reads dev's `.env`).
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
