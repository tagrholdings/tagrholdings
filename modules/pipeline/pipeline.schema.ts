import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenantsTable } from "@/modules/tenancy/tenancy.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";

/** One column of a board — `id` is what `pipeline_items.stage` stores. */
export const boardColumnSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type BoardColumn = z.infer<typeof boardColumnSchema>;

/**
 * A kanban board. "Leads" is the system default every tenant gets (seeded
 * lazily, see pipeline.service.ts's `ensureDefaultBoard`) and is what
 * /leads-inbox renders. Every other board is a user-created "project",
 * rendered as a tab on /pipeline (the Projects page). `archivedAt` hides a
 * project from those tabs without deleting its items; the system board is
 * never archived, renamed, or deleted.
 */
export const pipelineBoardsTable = pgTable("pipeline_boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id),
  name: text("name").notNull(),
  columns: jsonb("columns").$type<BoardColumn[]>().notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPipelineBoardSchema = createInsertSchema(pipelineBoardsTable, {
  columns: z.array(boardColumnSchema).min(1, "Add at least one column."),
});
export const selectPipelineBoardSchema = createSelectSchema(pipelineBoardsTable);

// Free text, not a DB enum — the column id within whichever board owns it.
export const pipelineItemsTable = pgTable("pipeline_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id),
  boardId: uuid("board_id")
    .notNull()
    .references(() => pipelineBoardsTable.id),
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
