import { db } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { organizationsTable } from "./organizations.schema";
import type { NewOrganization } from "./organizations.types";

export const organizationsRepository = {
  /**
   * `website`/`notes` ride along even though most callers (pickers) only
   * need `id`/`name` — the one extra query this saves (a dedicated
   * `findByIdWithDetails`) isn't worth a second shape to keep in sync, and
   * the org detail panel on /contacts needs those two fields from the same list.
   */
  async findAllForTenant(tenantId: string) {
    return db
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        website: organizationsTable.website,
        notes: organizationsTable.notes,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.tenantId, tenantId))
      .orderBy(organizationsTable.name);
  },

  async findByName(tenantId: string, name: string) {
    const [row] = await db
      .select({ id: organizationsTable.id, name: organizationsTable.name, website: organizationsTable.website, notes: organizationsTable.notes })
      .from(organizationsTable)
      .where(and(eq(organizationsTable.tenantId, tenantId), sql`lower(${organizationsTable.name}) = lower(${name})`));
    return row;
  },

  async create(tenantId: string, data: NewOrganization) {
    const [row] = await db
      .insert(organizationsTable)
      .values({ ...data, tenantId })
      .returning({ id: organizationsTable.id, name: organizationsTable.name, website: organizationsTable.website, notes: organizationsTable.notes });
    return row;
  },

  async update(tenantId: string, id: string, data: Partial<NewOrganization>) {
    const [row] = await db
      .update(organizationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(organizationsTable.tenantId, tenantId), eq(organizationsTable.id, id)))
      .returning({ id: organizationsTable.id, name: organizationsTable.name, website: organizationsTable.website, notes: organizationsTable.notes });
    return row;
  },
};
