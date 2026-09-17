import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { tenantsTable } from "@/modules/tenancy/tenancy.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";

// Free text, not a DB enum — stages are customizable per tenant.
export const pipelineItemsTable = pgTable("pipeline_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id),
  title: text("title").notNull(),
  stage: text("stage").notNull().default("defined"),
  contactId: uuid("contact_id").references(() => contactsTable.id),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPipelineItemSchema = createInsertSchema(pipelineItemsTable);
export const selectPipelineItemSchema = createSelectSchema(pipelineItemsTable);

export const moveItemStageSchema = insertPipelineItemSchema.pick({ id: true, stage: true });
