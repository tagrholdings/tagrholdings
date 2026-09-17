import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { tenantsTable } from "@/modules/tenancy/tenancy.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { pipelineItemsTable } from "@/modules/pipeline/pipeline.schema";

// type: "call" | "meeting" | "task" | "email" | "follow_up" — free text, not a DB enum.
export const activitiesTable = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id),
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  dueDate: timestamp("due_date"),
  done: boolean("done").notNull().default(false),
  priority: text("priority"),
  contactId: uuid("contact_id").references(() => contactsTable.id),
  pipelineItemId: uuid("pipeline_item_id").references(() => pipelineItemsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable);
export const selectActivitySchema = createSelectSchema(activitiesTable);
