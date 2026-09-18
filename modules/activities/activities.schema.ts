import { pgTable, uuid, text, timestamp, boolean, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";
import { pipelineItemsTable } from "@/modules/pipeline/pipeline.schema";

// type: "call" | "meeting" | "task" | "email" | "follow_up" — free text, not a DB enum.
// priority: "low" | "medium" | "high" — also free text, same reasoning.
// Every reference is a composite (tenant_id, x_id) foreign key — see pipeline.schema.ts.
export const activitiesTable = pgTable(
  "activities",
  {
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
    contactId: uuid("contact_id"),
    organizationId: uuid("organization_id"),
    pipelineItemId: uuid("pipeline_item_id"),
    /** "Assigned to" — a task owner, distinct from `contactId` ("this activity is about this
     *  contact"). Exactly one of these two should be set, enforced at the form/service level,
     *  not the DB (a CHECK constraint here would fight drizzle-zod's optional-field inference
     *  for little benefit at this scale). `assignedToUserId` has no FK — it's a Neon Auth
     *  user id (`neon_auth.user.id`), a schema this app doesn't own and can't reference from
     *  a `public` table's foreign key — so activitiesService checks tenant membership instead. */
    assignedToUserId: text("assigned_to_user_id"),
    assignedToContactId: uuid("assigned_to_contact_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "activities_contact_same_tenant_fk",
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contactsTable.tenantId, contactsTable.id],
    }),
    foreignKey({
      name: "activities_organization_same_tenant_fk",
      columns: [t.tenantId, t.organizationId],
      foreignColumns: [organizationsTable.tenantId, organizationsTable.id],
    }),
    foreignKey({
      name: "activities_pipeline_item_same_tenant_fk",
      columns: [t.tenantId, t.pipelineItemId],
      foreignColumns: [pipelineItemsTable.tenantId, pipelineItemsTable.id],
    }),
    foreignKey({
      name: "activities_assigned_contact_same_tenant_fk",
      columns: [t.tenantId, t.assignedToContactId],
      foreignColumns: [contactsTable.tenantId, contactsTable.id],
    }),
    tenantIsolationPolicy("activities"),
  ]
);

export const insertActivitySchema = createInsertSchema(activitiesTable, {
  subject: (s) => s.max(200),
  notes: z.string().max(10_000).nullish(),
  assignedToUserId: z.string().max(100).nullish(),
});
export const selectActivitySchema = createSelectSchema(activitiesTable);
