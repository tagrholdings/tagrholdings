import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, pgRole, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const tenantsTable = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenantsTable);
export const selectTenantSchema = createSelectSchema(tenantsTable);

/**
 * Links a Neon Auth user (managed — its table isn't ours to alter, so this
 * table stands in for a `tenantId` column on `user`) to a tenant. `userId`
 * is unique for now (one user = one tenant, per TENANCY.md's MVP model);
 * drop that constraint when checklist item 13 makes it many-to-many.
 */
export const tenantMembersTable = pgTable("tenant_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id),
  userId: text("user_id").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTenantMemberSchema = createInsertSchema(tenantMembersTable);
export const selectTenantMemberSchema = createSelectSchema(tenantMembersTable);

/**
 * Row-level security (see .agents/docs/TENANCY.md). `app_tenant` is a
 * NOLOGIN role without BYPASSRLS, created in drizzle/0004_app_tenant_role.sql
 * (drizzle-kit doesn't manage roles or grants here, hence `.existing()`).
 * `withTenant()` in lib/db.ts switches to it and sets `app.tenant_id` for
 * the duration of a transaction.
 */
export const appTenantRole = pgRole("app_tenant").existing();

/**
 * One policy per tenant-owned table: `app_tenant` only sees, inserts and
 * updates rows whose `tenant_id` matches the transaction's `app.tenant_id`.
 * `nullif(..., '')` makes an unset/reset setting compare as NULL (no rows)
 * instead of failing the `::uuid` cast — so a query that forgets to set the
 * tenant fails closed.
 */
export function tenantIsolationPolicy(tableName: string) {
  const sameTenant = sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`;
  return pgPolicy(`${tableName}_tenant_isolation`, {
    as: "permissive",
    for: "all",
    to: appTenantRole,
    using: sameTenant,
    withCheck: sameTenant,
  });
}
