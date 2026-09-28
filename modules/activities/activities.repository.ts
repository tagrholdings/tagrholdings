import { withTenant } from "@/lib/db";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
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
  notify: activitiesTable.notify,
  createdAt: activitiesTable.createdAt,
};

export const activitiesRepository = {
  async findAllWithRelations(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select(withRelationsSelection)
        .from(activitiesTable)
        .leftJoin(contactsTable, eq(activitiesTable.contactId, contactsTable.id))
        .leftJoin(organizationsTable, eq(activitiesTable.organizationId, organizationsTable.id))
        .leftJoin(assignedContactsTable, eq(activitiesTable.assignedToContactId, assignedContactsTable.id))
        .leftJoin(pipelineItemsTable, eq(activitiesTable.pipelineItemId, pipelineItemsTable.id))
        .where(eq(activitiesTable.tenantId, tenantId))
        .orderBy(activitiesTable.dueDate)
    );
  },

  async create(tenantId: string, data: NewActivity) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(activitiesTable)
        .values({ ...data, tenantId })
        .returning()
    );
    return row;
  },

  async setDone(tenantId: string, id: string, done: boolean) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(activitiesTable)
        .set({ done, updatedAt: new Date() })
        .where(and(eq(activitiesTable.tenantId, tenantId), eq(activitiesTable.id, id)))
        .returning()
    );
    return row;
  },

  /** Detaches activities from pipeline items about to be deleted — the activities themselves stay. */
  async unlinkPipelineItems(tenantId: string, pipelineItemIds: string[]) {
    if (pipelineItemIds.length === 0) return;
    await withTenant(tenantId, (tx) =>
      tx
        .update(activitiesTable)
        .set({ pipelineItemId: null, updatedAt: new Date() })
        .where(and(eq(activitiesTable.tenantId, tenantId), inArray(activitiesTable.pipelineItemId, pipelineItemIds)))
    );
  },

  async updateDate(tenantId: string, id: string, field: "dueDate" | "createdAt", date: Date) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(activitiesTable)
        // A moved due date is a new deadline: its reminder may fire again.
        .set({ [field]: date, ...(field === "dueDate" ? { notifiedAt: null } : {}), updatedAt: new Date() })
        .where(and(eq(activitiesTable.tenantId, tenantId), eq(activitiesTable.id, id)))
        .returning()
    );
    return row;
  },

  /**
   * Atomically takes the reminders that are due — open, `notify` on, not yet sent, due between `since` and `now` —
   * and stamps them as sent, so two overlapping job runs can never both send the same one. Reminders older than
   * `since` are skipped for good (a job that was down for days shouldn't fire a burst of stale alerts).
   */
  async claimDueReminders(tenantId: string, now: Date, since: Date) {
    return withTenant(tenantId, (tx) =>
      tx
        .update(activitiesTable)
        .set({ notifiedAt: now })
        .where(
          and(
            eq(activitiesTable.tenantId, tenantId),
            eq(activitiesTable.notify, true),
            eq(activitiesTable.done, false),
            isNull(activitiesTable.notifiedAt),
            lte(activitiesTable.dueDate, now),
            gt(activitiesTable.dueDate, since)
          )
        )
        .returning({
          id: activitiesTable.id,
          type: activitiesTable.type,
          subject: activitiesTable.subject,
          dueDate: activitiesTable.dueDate,
          assignedToUserId: activitiesTable.assignedToUserId,
        })
    );
  },
};
