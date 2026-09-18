import { db } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { activitiesTable } from "./activities.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";
import { pipelineItemsTable } from "@/modules/pipeline/pipeline.schema";
import type { NewActivity } from "./activities.types";

// aliased separately from contactsTable — `contactId` ("about this contact") and
// `assignedToContactId` ("owned by this contact") can both point at contacts, so
// the join needs two independent instances of the table, not one reused twice.
const assignedContactsTable = alias(contactsTable, "assigned_contacts");

const withRelationsSelection = {
  id: activitiesTable.id,
  type: activitiesTable.type,
  subject: activitiesTable.subject,
  dueDate: activitiesTable.dueDate,
  done: activitiesTable.done,
  priority: activitiesTable.priority,
  notes: activitiesTable.notes,
  contactId: activitiesTable.contactId,
  contactName: contactsTable.name,
  organizationId: activitiesTable.organizationId,
  organizationName: organizationsTable.name,
  pipelineItemId: activitiesTable.pipelineItemId,
  pipelineItemTitle: pipelineItemsTable.title,
  assignedToUserId: activitiesTable.assignedToUserId,
  assignedToContactId: activitiesTable.assignedToContactId,
  assignedToContactName: assignedContactsTable.name,
  createdAt: activitiesTable.createdAt,
};

export const activitiesRepository = {
  async findAllWithRelations(tenantId: string) {
    return db
      .select(withRelationsSelection)
      .from(activitiesTable)
      .leftJoin(contactsTable, eq(activitiesTable.contactId, contactsTable.id))
      .leftJoin(organizationsTable, eq(activitiesTable.organizationId, organizationsTable.id))
      .leftJoin(assignedContactsTable, eq(activitiesTable.assignedToContactId, assignedContactsTable.id))
      .leftJoin(pipelineItemsTable, eq(activitiesTable.pipelineItemId, pipelineItemsTable.id))
      .where(eq(activitiesTable.tenantId, tenantId))
      .orderBy(activitiesTable.dueDate);
  },

  async create(tenantId: string, data: NewActivity) {
    const [row] = await db
      .insert(activitiesTable)
      .values({ ...data, tenantId })
      .returning();
    return row;
  },

  async setDone(tenantId: string, id: string, done: boolean) {
    const [row] = await db
      .update(activitiesTable)
      .set({ done, updatedAt: new Date() })
      .where(and(eq(activitiesTable.tenantId, tenantId), eq(activitiesTable.id, id)))
      .returning();
    return row;
  },

  /** Detaches activities from pipeline items about to be deleted — the activities themselves stay. */
  async unlinkPipelineItems(tenantId: string, pipelineItemIds: string[]) {
    if (pipelineItemIds.length === 0) return;
    await db
      .update(activitiesTable)
      .set({ pipelineItemId: null, updatedAt: new Date() })
      .where(and(eq(activitiesTable.tenantId, tenantId), inArray(activitiesTable.pipelineItemId, pipelineItemIds)));
  },

  async updateDate(tenantId: string, id: string, field: "dueDate" | "createdAt", date: Date) {
    const [row] = await db
      .update(activitiesTable)
      .set({ [field]: date, updatedAt: new Date() })
      .where(and(eq(activitiesTable.tenantId, tenantId), eq(activitiesTable.id, id)))
      .returning();
    return row;
  },
};
