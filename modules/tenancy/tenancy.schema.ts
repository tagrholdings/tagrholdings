import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, pgRole, uuid, text, timestamp, unique, check } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * A workspace (one company / business unit). `slug` is its public name in the URL (`/w/<slug>/…`).
 *
 * `inboundLocalPart` is the workspace's own leads-inbox address — `<inboundLocalPart>@<INBOUND_EMAIL_DOMAIN>`.
 * Generated once at creation (slug + random token) and then STORED, so renaming a slug never breaks the address a
 * listing site was signed up with, and the token makes it unguessable. It is how an inbound email finds its workspace.
 *
 * `buyer*` is who this workspace's email signups sign up as (read by the lead engine, per tenant).
 */
export const tenantsTable = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  inboundLocalPart: text("inbound_local_part").notNull().unique(),
  buyerName: text("buyer_name"),
  buyerPhone: text("buyer_phone"),
  buyerCompany: text("buyer_company"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenantsTable);
export const selectTenantSchema = createSelectSchema(tenantsTable);

/**
 * Links a Neon Auth user (managed — its table isn't ours to alter, so this
 * table stands in for a `tenantId` column on `user`) to a workspace. Many-to-many:
 * one person can belong to several workspaces, with a role in each (`role` is
 * per membership — admin in one, member in another). See tenancy.types.ts.
 */
export const tenantMembersTable = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("tenant_members_tenant_user_unique").on(t.tenantId, t.userId),
    check("tenant_members_role_check", sql`${t.role} in ('admin', 'member')`),
  ]
);

/**
 * A platform-level role, above any workspace (today only `super_admin`: creates workspaces and can open any of
 * them). No `tenant_id` and no RLS, like `rate-limit`'s table. Granted ONLY by scripts/grant-super-admin.ts — there
 * is deliberately no action or screen that writes here. `userId` is a Neon Auth id (no FK possible).
 */
export const platformRolesTable = pgTable(
  "platform_roles",
  {
    userId: text("user_id").primaryKey(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [check("platform_roles_role_check", sql`${t.role} in ('super_admin')`)]
);

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
 * The external lead-discovery job's login role (drizzle/0006). Also
 * NOBYPASSRLS — the job sets `app.tenant_id` per transaction (taken from the
 * search profile it is processing) and the policies below hold it to that
 * tenant. The one cross-tenant thing it may do is *read* active search
 * profiles, which is how it discovers which tenants have work to do.
 */
export const leadScraperRole = pgRole("lead_scraper").existing();

/** Same tenant check as `tenantIsolationPolicy`, for the scraper role's write path. */
export function scraperTenantPolicy(tableName: string, forCommand: "all" | "select" | "insert" | "update" = "all") {
  const sameTenant = sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`;
  return pgPolicy(`${tableName}_scraper_${forCommand}`, {
    as: "permissive",
    for: forCommand,
    to: leadScraperRole,
    ...(forCommand === "insert" ? {} : { using: sameTenant }),
    ...(forCommand === "select" ? {} : { withCheck: sameTenant }),
  });
}

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
