import { pgTable, uuid, text, timestamp, boolean, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";
import { pipelineItemsTable } from "@/modules/pipeline/pipeline.schema";
import { tractionIssuesTable, tractionRocksTable } from "@/modules/traction/traction.schema";
import { teamPeopleTable } from "@/modules/team/team.schema";

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
    /** "Assigned to" — a task owner, distinct from `contactId` ("this activity is about this contact"): a team person
     *  (`assignedToPersonId`, modules/team — who may or may not have a login) or a contact. At most one of the two,
     *  enforced at the form/service level. */
    assignedToPersonId: uuid("assigned_to_person_id"),
    assignedToContactId: uuid("assigned_to_contact_id"),
    /** Who created the activity (a Neon Auth user id; no FK possible — another schema). Null for rows made by jobs. */
    createdByUserId: text("created_by_user_id"),
    /** "Enable notification": send a push reminder when `dueDate` arrives. Needs a due date (with a time). */
    notify: boolean("notify").notNull().default(false),
    /** Set when the reminder went out (claimed by the reminder job) so it fires once; cleared when `dueDate` moves. */
    notifiedAt: timestamp("notified_at"),
    /** An L10 To-Do — a 7-day commitment made in the weekly meeting (Traction). Shown under the "L10 To-Dos" filter. */
    l10Todo: boolean("l10_todo").notNull().default(false),
    /** The Issue this To-Do came out of, when it was created by solving one. */
    issueId: uuid("issue_id"),
    /** The Rock this activity moves forward — a Rock's milestones and to-dos (Traction). */
    rockId: uuid("rock_id"),
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
    foreignKey({
      name: "activities_assigned_person_same_tenant_fk",
      columns: [t.tenantId, t.assignedToPersonId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    foreignKey({
      name: "activities_issue_same_tenant_fk",
      columns: [t.tenantId, t.issueId],
      foreignColumns: [tractionIssuesTable.tenantId, tractionIssuesTable.id],
    }),
    foreignKey({
      name: "activities_rock_same_tenant_fk",
      columns: [t.tenantId, t.rockId],
      foreignColumns: [tractionRocksTable.tenantId, tractionRocksTable.id],
    }),
    tenantIsolationPolicy("activities"),
  ]
);

export const insertActivitySchema = createInsertSchema(activitiesTable, {
  subject: (s) => s.max(200),
  notes: z.string().max(10_000).nullish(),
  assignedToPersonId: z.uuid().nullish(),
  rockId: z.uuid().nullish(),
});
export const selectActivitySchema = createSelectSchema(activitiesTable);
