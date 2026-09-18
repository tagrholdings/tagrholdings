import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { pipelineItemsTable } from "./pipeline.schema";

export const pipelineRepository = {
  async findByContactId(tenantId: string, contactId: string) {
    return db
      .select({
        id: pipelineItemsTable.id,
        title: pipelineItemsTable.title,
        stage: pipelineItemsTable.stage,
        createdAt: pipelineItemsTable.createdAt,
      })
      .from(pipelineItemsTable)
      .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.contactId, contactId)))
      .orderBy(pipelineItemsTable.createdAt);
  },
};
