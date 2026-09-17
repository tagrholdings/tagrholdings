import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { tenantsTable } from "@/modules/tenancy/tenancy.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";

export const contactsTable = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContactSchema = createInsertSchema(contactsTable);
export const selectContactSchema = createSelectSchema(contactsTable);
