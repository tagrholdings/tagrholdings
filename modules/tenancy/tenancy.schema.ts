import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
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
