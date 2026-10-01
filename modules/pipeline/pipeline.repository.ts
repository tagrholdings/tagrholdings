import { withTenant } from "@/lib/db";
import { and, eq, inArray, sql } from "drizzle-orm";
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
    return withTenant(tenantId, (tx) =>
      tx
        .select(withRelationsSelection)
        .from(pipelineItemsTable)
        .leftJoin(contactsTable, eq(pipelineItemsTable.contactId, contactsTable.id))
        .leftJoin(organizationsTable, eq(pipelineItemsTable.organizationId, organizationsTable.id))
        .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.boardId, boardId)))
        .orderBy(pipelineItemsTable.createdAt)
    );
  },

  async findByIdWithRelations(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select(withRelationsSelection)
        .from(pipelineItemsTable)
        .leftJoin(contactsTable, eq(pipelineItemsTable.contactId, contactsTable.id))
        .leftJoin(organizationsTable, eq(pipelineItemsTable.organizationId, organizationsTable.id))
        .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.id, id)))
    );
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
    return withTenant(tenantId, (tx) =>
      tx
        .select({ ...withRelationsSelection, boardName: pipelineBoardsTable.name, boardIsSystem: pipelineBoardsTable.isSystem })
        .from(pipelineItemsTable)
        .innerJoin(pipelineBoardsTable, eq(pipelineItemsTable.boardId, pipelineBoardsTable.id))
        .leftJoin(contactsTable, eq(pipelineItemsTable.contactId, contactsTable.id))
        .leftJoin(organizationsTable, eq(pipelineItemsTable.organizationId, organizationsTable.id))
        .where(eq(pipelineItemsTable.tenantId, tenantId))
        .orderBy(pipelineItemsTable.title)
    );
  },

  async create(tenantId: string, data: NewPipelineItem) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(pipelineItemsTable)
        .values({ ...data, tenantId })
        .returning()
    );
    return row;
  },

  async updateStage(tenantId: string, id: string, stage: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(pipelineItemsTable)
        .set({ stage, updatedAt: new Date() })
        .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.id, id)))
        .returning()
    );
    return row;
  },

  /** How many cards sit in each stage of a board (`{ stageId: count }`) — stages with none are absent. */
  async countByStage(tenantId: string, boardId: string) {
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .select({ stage: pipelineItemsTable.stage, count: sql<number>`count(*)::int` })
        .from(pipelineItemsTable)
        .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.boardId, boardId)))
        .groupBy(pipelineItemsTable.stage)
    );
    return Object.fromEntries(rows.map((r) => [r.stage, r.count])) as Record<string, number>;
  },

  async findIdsForBoard(tenantId: string, boardId: string) {
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .select({ id: pipelineItemsTable.id })
        .from(pipelineItemsTable)
        .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.boardId, boardId)))
    );
    return rows.map((r) => r.id);
  },

  async deleteMany(tenantId: string, ids: string[]) {
    if (ids.length === 0) return;
    await withTenant(tenantId, (tx) =>
      tx
        .delete(pipelineItemsTable)
        .where(and(eq(pipelineItemsTable.tenantId, tenantId), inArray(pipelineItemsTable.id, ids)))
    );
  },

  async update(tenantId: string, id: string, data: Partial<NewPipelineItem>) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(pipelineItemsTable)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.id, id)))
        .returning()
    );
    return row;
  },
};

export const pipelineBoardsRepository = {
  async findAllForTenant(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(pipelineBoardsTable)
        .where(eq(pipelineBoardsTable.tenantId, tenantId))
        .orderBy(pipelineBoardsTable.createdAt)
    );
  },

  async findSystemBoard(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx.query.pipelineBoardsTable.findFirst({
        where: and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.isSystem, true)),
      })
    );
  },

  async findById(tenantId: string, id: string) {
    return withTenant(tenantId, (tx) =>
      tx.query.pipelineBoardsTable.findFirst({
        where: and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.id, id)),
      })
    );
  },

  async create(tenantId: string, data: { name: string; columns: BoardColumn[]; isSystem?: boolean }) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(pipelineBoardsTable)
        .values({ ...data, tenantId })
        .returning()
    );
    return row;
  },

  async update(tenantId: string, id: string, data: { name?: string; archivedAt?: Date | null }) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(pipelineBoardsTable)
        .set(data)
        .where(and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.id, id)))
        .returning()
    );
    return row;
  },

  /**
   * Replaces a board's stages and, in the SAME transaction, moves the cards of removed stages to another one — so a card is
   * never left pointing at a stage the board no longer has.
   */
  async updateColumns(tenantId: string, id: string, columns: BoardColumn[], move?: { from: string[]; to: string }) {
    return withTenant(tenantId, async (tx) => {
      if (move && move.from.length > 0) {
        await tx
          .update(pipelineItemsTable)
          .set({ stage: move.to, updatedAt: new Date() })
          .where(
            and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.boardId, id), inArray(pipelineItemsTable.stage, move.from))
          );
      }
      const [row] = await tx
        .update(pipelineBoardsTable)
        .set({ columns })
        .where(and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.id, id)))
        .returning();
      return row;
    });
  },

  async delete(tenantId: string, id: string) {
    await withTenant(tenantId, (tx) =>
      tx
        .delete(pipelineBoardsTable)
        .where(and(eq(pipelineBoardsTable.tenantId, tenantId), eq(pipelineBoardsTable.id, id)))
    );
  },
};
