import { withTenant } from "@/lib/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { teamPeopleTable } from "./team.schema";
import type { PersonRow } from "./team.types";

const selection = {
  id: teamPeopleTable.id,
  name: teamPeopleTable.name,
  email: teamPeopleTable.email,
  title: teamPeopleTable.title,
  userId: teamPeopleTable.userId,
  archivedAt: teamPeopleTable.archivedAt,
};

/** Pure queries — every one filtered by tenant_id AND run inside withTenant (RLS). */
export const teamRepository = {
  async findAll(tenantId: string): Promise<PersonRow[]> {
    return withTenant(tenantId, (tx) =>
      tx.select(selection).from(teamPeopleTable).where(eq(teamPeopleTable.tenantId, tenantId)).orderBy(asc(teamPeopleTable.name))
    );
  },

  async findById(tenantId: string, id: string): Promise<PersonRow | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx.select(selection).from(teamPeopleTable).where(and(eq(teamPeopleTable.tenantId, tenantId), eq(teamPeopleTable.id, id)))
    );
    return row;
  },

  async insert(tenantId: string, values: { name: string; email: string | null; title: string | null; userId?: string | null }) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(teamPeopleTable).values({ ...values, tenantId }).returning(selection));
    return row;
  },

  async update(tenantId: string, id: string, values: Partial<{ name: string; email: string | null; title: string | null; userId: string | null; archivedAt: Date | null }>) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(teamPeopleTable)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(teamPeopleTable.tenantId, tenantId), eq(teamPeopleTable.id, id)))
        .returning(selection)
    );
    return row;
  },

  /** Links a login to an unlinked person — only if that person still has no login (two syncs can't both win). */
  async linkIfUnlinked(tenantId: string, id: string, userId: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(teamPeopleTable)
        .set({ userId, updatedAt: new Date() })
        .where(and(eq(teamPeopleTable.tenantId, tenantId), eq(teamPeopleTable.id, id), isNull(teamPeopleTable.userId)))
        .returning(selection)
    );
    return row;
  },

  /** A new person for a login; nothing when that login already has one (the unique (tenant_id, user_id) wins). */
  async insertForUser(tenantId: string, values: { name: string; email: string | null; userId: string }) {
    await withTenant(tenantId, (tx) =>
      tx.insert(teamPeopleTable).values({ ...values, tenantId }).onConflictDoNothing({ target: [teamPeopleTable.tenantId, teamPeopleTable.userId] })
    );
  },
};
