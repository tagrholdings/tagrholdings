import { pgTable, uuid, text, timestamp, jsonb, boolean, unique, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";

/** One column of a board — `id` is what `pipeline_items.stage` stores. */
export const boardColumnSchema = z.object({
  id: z.string().max(100),
  label: z.string().max(60),
});
export type BoardColumn = z.infer<typeof boardColumnSchema>;

/**
 * A kanban board. "Leads" is the system default every tenant gets (seeded
 * lazily, see pipeline.service.ts's `ensureDefaultBoard`) and is what
 * /leads renders. Every other board is a user-created "project",
 * rendered as a tab on /pipeline (the Projects page). `archivedAt` hides a
 * project from those tabs without deleting its items; the system board is
 * never archived, renamed, or deleted.
 */
export const pipelineBoardsTable = pgTable(
  "pipeline_boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    name: text("name").notNull(),
    columns: jsonb("columns").$type<BoardColumn[]>().notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("pipeline_boards_tenant_id_id_unique").on(t.tenantId, t.id),
    tenantIsolationPolicy("pipeline_boards"),
  ]
);

export const insertPipelineBoardSchema = createInsertSchema(pipelineBoardsTable, {
  name: (s) => s.max(100),
  columns: z.array(boardColumnSchema).min(1, "Add at least one column.").max(10, "Up to 10 columns."),
});
export const selectPipelineBoardSchema = createSelectSchema(pipelineBoardsTable);

// Free text, not a DB enum — the column id within whichever board owns it.
// Every reference below is a composite (tenant_id, x_id) foreign key, so
// Postgres itself rejects linking an item to another tenant's board,
// contact or organization.
export const pipelineItemsTable = pgTable(
  "pipeline_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    boardId: uuid("board_id").notNull(),
    title: text("title").notNull(),
    stage: text("stage").notNull().default("defined"),
    contactId: uuid("contact_id"),
    organizationId: uuid("organization_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("pipeline_items_tenant_id_id_unique").on(t.tenantId, t.id),
    foreignKey({
      name: "pipeline_items_board_same_tenant_fk",
      columns: [t.tenantId, t.boardId],
      foreignColumns: [pipelineBoardsTable.tenantId, pipelineBoardsTable.id],
    }),
    foreignKey({
      name: "pipeline_items_contact_same_tenant_fk",
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contactsTable.tenantId, contactsTable.id],
    }),
    foreignKey({
      name: "pipeline_items_organization_same_tenant_fk",
      columns: [t.tenantId, t.organizationId],
      foreignColumns: [organizationsTable.tenantId, organizationsTable.id],
    }),
    tenantIsolationPolicy("pipeline_items"),
  ]
);

export const insertPipelineItemSchema = createInsertSchema(pipelineItemsTable, {
  title: (s) => s.max(200),
  stage: (s) => s.max(100),
  notes: z.string().max(10_000).nullish(),
});
export const selectPipelineItemSchema = createSelectSchema(pipelineItemsTable);

export const moveItemStageSchema = insertPipelineItemSchema.pick({ id: true, stage: true });
