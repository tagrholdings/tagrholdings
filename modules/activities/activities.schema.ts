import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { tenantsTable } from "@/modules/tenancy/tenancy.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";
import { pipelineItemsTable } from "@/modules/pipeline/pipeline.schema";

// type: "call" | "meeting" | "task" | "email" | "follow_up" — free text, not a DB enum.
// priority: "low" | "medium" | "high" — also free text, same reasoning.
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
  notes: text("notes"),
  contactId: uuid("contact_id").references(() => contactsTable.id),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  pipelineItemId: uuid("pipeline_item_id").references(() => pipelineItemsTable.id),
  /** "Assigned to" — a task owner, distinct from `contactId` ("this activity is about this
   *  contact"). Exactly one of these two should be set, enforced at the form/service level,
   *  not the DB (a CHECK constraint here would fight drizzle-zod's optional-field inference
   *  for little benefit at this scale). `assignedToUserId` has no FK — it's a Neon Auth
   *  user id (`neon_auth.user.id`), a schema this app doesn't own and can't reference from
   *  a `public` table's foreign key. */
  assignedToUserId: text("assigned_to_user_id"),
  assignedToContactId: uuid("assigned_to_contact_id").references(() => contactsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable);
export const selectActivitySchema = createSelectSchema(activitiesTable);
