import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { activitiesTable } from "./activities.schema";

export const activitiesRepository = {
  async findByContactId(tenantId: string, contactId: string) {
    return db
      .select({
        id: activitiesTable.id,
        type: activitiesTable.type,
        subject: activitiesTable.subject,
        dueDate: activitiesTable.dueDate,
        done: activitiesTable.done,
        priority: activitiesTable.priority,
        createdAt: activitiesTable.createdAt,
      })
      .from(activitiesTable)
      .where(and(eq(activitiesTable.tenantId, tenantId), eq(activitiesTable.contactId, contactId)))
      .orderBy(activitiesTable.createdAt);
  },
};
