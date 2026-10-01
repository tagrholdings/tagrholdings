import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TENANT_DATA_TABLES } from "./tenancy.constants";

/**
 * Deleting a workspace removes its rows table by table (tenancy.repository.ts → deleteTenantAndData). A new table with a
 * `tenant_id` that isn't in that list would make every future delete fail on its foreign key — or, worse, be forgotten.
 * This reads the schema files and fails until the list is updated.
 */
const MODULES = join(__dirname, "..");
// These are handled by deleteTenantAndData itself (or hold no workspace data).
const HANDLED_ELSEWHERE = new Set(["tenants", "tenant_members", "platform_roles"]);

function tenantTables(): string[] {
  const found: string[] = [];
  for (const dir of readdirSync(MODULES)) {
    let files: string[];
    try {
      files = readdirSync(join(MODULES, dir)).filter((f) => f.endsWith(".schema.ts"));
    } catch {
      continue;
    }
    for (const file of files) {
      const source = readFileSync(join(MODULES, dir, file), "utf8");
      // Split at every pgTable( and look at each table's own definition.
      const parts = source.split(/pgTable\(\s*/).slice(1);
      for (const part of parts) {
        const name = part.match(/^"([a-z_]+)"/)?.[1];
        if (name && /uuid\("tenant_id"\)/.test(part.split(/\n\);?\n/)[0]) && !HANDLED_ELSEWHERE.has(name)) found.push(name);
      }
    }
  }
  return found;
}

describe("TENANT_DATA_TABLES", () => {
  it("lists every table that has a tenant_id column", () => {
    const tables = tenantTables();
    expect(tables.length).toBeGreaterThan(8); // the scan itself works
    for (const table of tables) {
      expect(TENANT_DATA_TABLES as readonly string[], `add "${table}" to TENANT_DATA_TABLES`).toContain(table);
    }
  });

  it("names no table that doesn't exist", () => {
    const tables = new Set(tenantTables());
    for (const table of TENANT_DATA_TABLES) expect(tables.has(table), `"${table}" has no tenant_id table in the schema`).toBe(true);
  });

  it("deletes children before the rows they reference", () => {
    const order: string[] = [...TENANT_DATA_TABLES];
    const before = (child: string, parent: string) => expect(order.indexOf(child)).toBeLessThan(order.indexOf(parent));
    before("lead_api_usage", "lead_runs");
    before("lead_runs", "search_profiles");
    before("raw_leads", "search_profiles");
    before("raw_leads", "pipeline_items");
    before("activities", "pipeline_items");
    before("activities", "contacts");
    before("pipeline_items", "pipeline_boards");
    before("pipeline_items", "contacts");
    before("contacts", "organizations");
  });
});
