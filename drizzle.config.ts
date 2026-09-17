import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Mirrors Next.js precedence: .env.local (development branch) wins over
// .env (production) — so `npm run db:migrate` targets dev by default and a
// production migration needs an explicit DATABASE_URL_UNPOOLED override.
config({ path: ".env" });
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "./modules/*/*.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Direct (non-pooled) connection — required for migrations.
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
