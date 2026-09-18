import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";

export const organizationsTable = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    name: text("name").notNull(),
    website: text("website"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Target of the composite (tenant_id, organization_id) foreign keys —
    // lets Postgres reject a reference to another tenant's organization.
    unique("organizations_tenant_id_id_unique").on(t.tenantId, t.id),
    tenantIsolationPolicy("organizations"),
  ]
);

export const insertOrganizationSchema = createInsertSchema(organizationsTable, {
  name: (s) => s.max(200),
  website: z.string().max(2048).nullish(),
  notes: z.string().max(10_000).nullish(),
});
export const selectOrganizationSchema = createSelectSchema(organizationsTable);
