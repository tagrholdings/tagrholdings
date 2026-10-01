import { withTenant } from "@/lib/db";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { activitiesTable } from "./activities.schema";
import { contactsTable } from "@/modules/contacts/contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";
import { pipelineItemsTable } from "@/modules/pipeline/pipeline.schema";
import type { ActivityUpdate, NewActivity } from "./activities.types";

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

  async create(tenantId: string, data: NewActivity, createdByUserId: string | null) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(activitiesTable)
        .values({ ...data, tenantId, createdByUserId })
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

  /** Replaces every editable field (an empty one is cleared). A moved due date, or a reminder newly switched on, may fire again. */
  async update(tenantId: string, data: ActivityUpdate) {
    return withTenant(tenantId, async (tx) => {
      const where = and(eq(activitiesTable.tenantId, tenantId), eq(activitiesTable.id, data.id));
      const [existing] = await tx.select({ dueDate: activitiesTable.dueDate, notify: activitiesTable.notify }).from(activitiesTable).where(where);
      if (!existing) return undefined;

      const dueChanged = (existing.dueDate?.getTime() ?? null) !== (data.dueDate?.getTime() ?? null);
      const notify = data.notify ?? false;
      const [row] = await tx
        .update(activitiesTable)
        .set({
          type: data.type,
          subject: data.subject,
          dueDate: data.dueDate ?? null,
          priority: data.priority ?? null,
          notes: data.notes ?? null,
          contactId: data.contactId ?? null,
          organizationId: data.organizationId ?? null,
          pipelineItemId: data.pipelineItemId ?? null,
          assignedToUserId: data.assignedToUserId ?? null,
          assignedToContactId: data.assignedToContactId ?? null,
          notify,
          ...(dueChanged || (notify && !existing.notify) ? { notifiedAt: null } : {}),
          updatedAt: new Date(),
        })
        .where(where)
        .returning();
      return row;
    });
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
