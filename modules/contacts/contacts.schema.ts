import { pgTable, uuid, text, timestamp, unique, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";

export const contactsTable = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    organizationId: uuid("organization_id"),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("contacts_tenant_id_id_unique").on(t.tenantId, t.id),
    // Composite, not just organization_id → organizations.id: the referenced
    // organization must belong to the same tenant as this contact.
    foreignKey({
      name: "contacts_organization_same_tenant_fk",
      columns: [t.tenantId, t.organizationId],
      foreignColumns: [organizationsTable.tenantId, organizationsTable.id],
    }),
    tenantIsolationPolicy("contacts"),
  ]
);

export const insertContactSchema = createInsertSchema(contactsTable, {
  name: (s) => s.max(200),
  email: z.string().max(254).nullish(),
  phone: z.string().max(50).nullish(),
});
export const selectContactSchema = createSelectSchema(contactsTable);
