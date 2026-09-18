import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { contactsTable } from "./contacts.schema";
import { organizationsTable } from "@/modules/organizations/organizations.schema";
import type { NewContact } from "./contacts.types";

export const contactsRepository = {
  async findAllWithOrganization(tenantId: string) {
    return db
      .select({
        id: contactsTable.id,
        name: contactsTable.name,
        email: contactsTable.email,
        phone: contactsTable.phone,
        organizationId: contactsTable.organizationId,
        organizationName: organizationsTable.name,
        createdAt: contactsTable.createdAt,
      })
      .from(contactsTable)
      .leftJoin(organizationsTable, eq(contactsTable.organizationId, organizationsTable.id))
      .where(eq(contactsTable.tenantId, tenantId))
      .orderBy(contactsTable.name);
  },

  async findByIdWithOrganization(tenantId: string, id: string) {
    const [row] = await db
      .select({
        id: contactsTable.id,
        name: contactsTable.name,
        email: contactsTable.email,
        phone: contactsTable.phone,
        organizationId: contactsTable.organizationId,
        organizationName: organizationsTable.name,
        createdAt: contactsTable.createdAt,
        updatedAt: contactsTable.updatedAt,
      })
      .from(contactsTable)
      .leftJoin(organizationsTable, eq(contactsTable.organizationId, organizationsTable.id))
      .where(and(eq(contactsTable.tenantId, tenantId), eq(contactsTable.id, id)));
    return row;
  },

  async create(tenantId: string, data: NewContact) {
    const [row] = await db
      .insert(contactsTable)
      .values({ ...data, tenantId })
      .returning();
    return row;
  },

  async update(tenantId: string, id: string, data: Partial<NewContact>) {
    const [row] = await db
      .update(contactsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(contactsTable.tenantId, tenantId), eq(contactsTable.id, id)))
      .returning();
    return row;
  },
};
