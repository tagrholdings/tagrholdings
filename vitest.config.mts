import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "scraper/**"],
  },
  resolve: {
    alias: [
      // `server-only` throws outside a React Server Components build; tests aren't one.
      { find: /^server-only$/, replacement: path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") },
      { find: /^@\//, replacement: `${path.resolve(import.meta.dirname)}/` },
    ],
  },
});
