import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Tenant-owned tables must be queried through `withTenant()` so Postgres
  // RLS applies — the plain `db` connects with BYPASSRLS. Only modules whose
  // tables carry no tenant_id (tenancy, rate-limit) may import it.
  {
    files: ["modules/**/*.ts"],
    ignores: ["modules/tenancy/**", "modules/rate-limit/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              importNames: ["db"],
              message: "Query tenant tables through withTenant() so row-level security applies (see .agents/docs/TENANCY.md).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
