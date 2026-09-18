import { db } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { pipelineItemsTable, pipelineBoardsTable, type BoardColumn } from "./pipeline.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";
import type { NewPipelineItem } from "./pipeline.types";

const withRelationsSelection = {
  id: pipelineItemsTable.id,
  boardId: pipelineItemsTable.boardId,
  title: pipelineItemsTable.title,
  stage: pipelineItemsTable.stage,
  notes: pipelineItemsTable.notes,
  contactId: pipelineItemsTable.contactId,
  contactName: contactsTable.name,
  organizationId: pipelineItemsTable.organizationId,
  organizationName: organizationsTable.name,
  createdAt: pipelineItemsTable.createdAt,
  updatedAt: pipelineItemsTable.updatedAt,
};

export const pipelineRepository = {
  async findAllForBoard(tenantId: string, boardId: string) {
    return db
      .select(withRelationsSelection)
      .from(pipelineItemsTable)
      .leftJoin(contactsTable, eq(pipelineItemsTable.contactId, contactsTable.id))
      .leftJoin(organizationsTable, eq(pipelineItemsTable.organizationId, organizationsTable.id))
      .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.boardId, boardId)))
      .orderBy(pipelineItemsTable.createdAt);
  },

  async findByIdWithRelations(tenantId: string, id: string) {
    const [row] = await db
      .select(withRelationsSelection)
      .from(pipelineItemsTable)
      .leftJoin(contactsTable, eq(pipelineItemsTable.contactId, contactsTable.id))
      .leftJoin(organizationsTable, eq(pipelineItemsTable.organizationId, organizationsTable.id))
      .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.id, id)));
    return row;
  },

  /**
   * Flat list across every board, with the same relations as
   * `findAllForBoard` plus which board each item is on — the one query
   * behind every "linked lead/project" picker, a contact's or
   * organization's related items on /contacts, and (via `PipelineItemSummary`)
   * anywhere a full `PipelineItemRow`-shaped detail panel is opened outside
   * its own board page.
   */
  async findAllForTenant(tenantId: string) {
    return db
      .select({ ...withRelationsSelection, boardName: pipelineBoardsTable.name, boardIsSystem: pipelineBoardsTable.isSystem })
      .from(pipelineItemsTable)
      .innerJoin(pipelineBoardsTable, eq(pipelineItemsTable.boardId, pipelineBoardsTable.id))
      .leftJoin(contactsTable, eq(pipelineItemsTable.contactId, contactsTable.id))
      .leftJoin(organizationsTable, eq(pipelineItemsTable.organizationId, organizationsTable.id))
      .where(eq(pipelineItemsTable.tenantId, tenantId))
      .orderBy(pipelineItemsTable.title);
  },

  async create(tenantId: string, data: NewPipelineItem) {
    const [row] = await db
      .insert(pipelineItemsTable)
      .values({ ...data, tenantId })
      .returning();
    return row;
  },

  async updateStage(tenantId: string, id: string, stage: string) {
    const [row] = await db
      .update(pipelineItemsTable)
      .set({ stage, updatedAt: new Date() })
      .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.id, id)))
      .returning();
    return row;
  },

  async findIdsForBoard(tenantId: string, boardId: string) {
    const rows = await db
      .select({ id: pipelineItemsTable.id })
      .from(pipelineItemsTable)
      .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.boardId, boardId)));
    return rows.map((r) => r.id);
  },

  async deleteMany(tenantId: string, ids: string[]) {
    if (ids.length === 0) return;
    await db
      .delete(pipelineItemsTable)
      .where(and(eq(pipelineItemsTable.tenantId, tenantId), inArray(pipelineItemsTable.id, ids)));
  },

  async update(tenantId: string, id: string, data: Partial<NewPipelineItem>) {
    const [row] = await db
      .update(pipelineItemsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.id, id)))
      .returning();
    return row;
  },
};

export const pipelineBoardsRepository = {
  async findAllForTenant(tenantId: string) {
    return db
      .select()
      .from(pipelineBoardsTable)
      .where(eq(pipelineBoardsTable.tenantId, tenantId))
      .orderBy(pipelineBoardsTable.createdAt);
  },

  async findSystemBoard(tenantId: string) {
    return db.query.pipelineBoardsTable.findFirst({
      where: and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.isSystem, true)),
    });
  },

  async findById(tenantId: string, id: string) {
    return db.query.pipelineBoardsTable.findFirst({
      where: and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.id, id)),
    });
  },

  async create(tenantId: string, data: { name: string; columns: BoardColumn[]; isSystem?: boolean }) {
    const [row] = await db
      .insert(pipelineBoardsTable)
      .values({ ...data, tenantId })
      .returning();
    return row;
  },

  async update(tenantId: string, id: string, data: { name?: string; archivedAt?: Date | null }) {
    const [row] = await db
      .update(pipelineBoardsTable)
      .set(data)
      .where(and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.id, id)))
      .returning();
    return row;
  },

  async delete(tenantId: string, id: string) {
    await db
      .delete(pipelineBoardsTable)
      .where(and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.id, id)));
  },
};
