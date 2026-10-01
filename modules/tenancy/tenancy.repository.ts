import { db } from "@/lib/db";
import { platformRolesTable, tenantMembersTable, tenantsTable } from "./tenancy.schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { TENANT_DATA_TABLES } from "./tenancy.constants";
import type { PlatformRole, WorkspaceRole } from "./tenancy.types";

// Uses the unscoped `db`, not `withTenant`: resolving a workspace is what
// happens *before* a tenant is known, and tenants/tenant_members/platform_roles
// have no tenant RLS policy (see TENANCY.md).
export const tenancyRepository = {
  async findMember(tenantId: string, userId: string) {
    return db.query.tenantMembersTable.findFirst({
      where: and(eq(tenantMembersTable.tenantId, tenantId), eq(tenantMembersTable.userId, userId)),
    });
  },

  /** Links a Neon Auth user to a workspace with a role. Returns false when they were already a member. */
  async insertMember(tenantId: string, userId: string, role: WorkspaceRole) {
    const inserted = await db
      .insert(tenantMembersTable)
      .values({ tenantId, userId, role })
      .onConflictDoNothing({ target: [tenantMembersTable.tenantId, tenantMembersTable.userId] })
      .returning({ id: tenantMembersTable.id });
    return inserted.length > 0;
  },

  async updateMemberRole(tenantId: string, userId: string, role: WorkspaceRole) {
    const updated = await db
      .update(tenantMembersTable)
      .set({ role })
      .where(and(eq(tenantMembersTable.tenantId, tenantId), eq(tenantMembersTable.userId, userId)))
      .returning({ id: tenantMembersTable.id });
    return updated.length > 0;
  },

  async deleteMember(tenantId: string, userId: string) {
    const deleted = await db
      .delete(tenantMembersTable)
      .where(and(eq(tenantMembersTable.tenantId, tenantId), eq(tenantMembersTable.userId, userId)))
      .returning({ id: tenantMembersTable.id });
    return deleted.length > 0;
  },

  async countAdmins(tenantId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMembersTable)
      .where(and(eq(tenantMembersTable.tenantId, tenantId), eq(tenantMembersTable.role, "admin")));
    return row?.count ?? 0;
  },

  async findTenantById(id: string) {
    return db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.id, id),
    });
  },

  async findTenantBySlug(slug: string) {
    return db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.slug, slug),
    });
  },

  /** An inbound email's recipient local part → the workspace that owns that address. */
  async findTenantByInboundLocalPart(localPart: string) {
    return db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.inboundLocalPart, localPart),
    });
  },

  /** Every ACTIVE workspace — for background jobs that sweep all of them (there is no session/tenant to start from). Archived ones are skipped. */
  async findAllTenants() {
    return db
      .select({ id: tenantsTable.id, slug: tenantsTable.slug, name: tenantsTable.name })
      .from(tenantsTable)
      .where(isNull(tenantsTable.archivedAt))
      .orderBy(asc(tenantsTable.name));
  },

  /** Every workspace, archived or not, with its member count — the super admin's list. */
  async findAllForAdmin() {
    const result = await db.execute<{ id: string; name: string; slug: string; inbound_local_part: string; archived_at: Date | null; member_count: number }>(sql`
      select t.id, t.name, t.slug, t.inbound_local_part, t.archived_at,
             (select count(*)::int from tenant_members tm where tm.tenant_id = t.id) as member_count
      from tenants t
      order by t.archived_at is not null, t.name
    `);
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      inboundLocalPart: r.inbound_local_part,
      archivedAt: r.archived_at ? new Date(r.archived_at) : null,
      memberCount: r.member_count,
    }));
  },

  async updateTenantName(id: string, name: string) {
    const [row] = await db.update(tenantsTable).set({ name }).where(eq(tenantsTable.id, id)).returning();
    return row;
  },

  async setTenantArchived(id: string, archivedAt: Date | null) {
    const [row] = await db.update(tenantsTable).set({ archivedAt }).where(eq(tenantsTable.id, id)).returning();
    return row;
  },

  /**
   * Deletes a workspace and EVERYTHING in it, in one transaction (all or nothing). Children go before the rows they
   * reference — the composite (tenant_id, x_id) foreign keys have no cascade. Raw SQL on other modules' tables on
   * purpose: this is the one platform-level operation that has to reach all of them, and it uses the unscoped `db`
   * (RLS doesn't apply) with an explicit tenant filter on every statement. tenancy.service.test.ts fails if a new
   * tenant table is added to the schema without being added here.
   */
  async deleteTenantAndData(tenantId: string) {
    await db.transaction(async (tx) => {
      for (const table of TENANT_DATA_TABLES) {
        await tx.execute(sql`delete from ${sql.identifier(table)} where tenant_id = ${tenantId}`);
      }
      await tx.delete(tenantMembersTable).where(eq(tenantMembersTable.tenantId, tenantId));
      await tx.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    });
  },

  /** The workspaces a person belongs to, with their role in each. */
  async findWorkspacesForUser(userId: string) {
    return db
      .select({ id: tenantsTable.id, slug: tenantsTable.slug, name: tenantsTable.name, role: tenantMembersTable.role })
      .from(tenantMembersTable)
      .innerJoin(tenantsTable, eq(tenantsTable.id, tenantMembersTable.tenantId))
      .where(and(eq(tenantMembersTable.userId, userId), isNull(tenantsTable.archivedAt)))
      .orderBy(asc(tenantsTable.name));
  },

  async insertTenant(values: { name: string; slug: string; inboundLocalPart: string }) {
    const inserted = await db.insert(tenantsTable).values(values).onConflictDoNothing().returning();
    return inserted[0] ?? null;
  },

  async updateBuyerIdentity(tenantId: string, values: { buyerName: string | null; buyerPhone: string | null; buyerCompany: string | null }) {
    await db.update(tenantsTable).set(values).where(eq(tenantsTable.id, tenantId));
  },

  async findPlatformRole(userId: string): Promise<PlatformRole | null> {
    const row = await db.query.platformRolesTable.findFirst({ where: eq(platformRolesTable.userId, userId) });
    return (row?.role as PlatformRole | undefined) ?? null;
  },

  /**
   * Raw SQL, not a drizzle-schema join — `neon_auth.user` (name/email) is
   * managed by Neon Auth, not a table this app defines in its own drizzle
   * schema, so there's no `db.query.user` to join against. Used for the
   * Activities "assigned to" picker and the members list.
   */
  async findMembersWithUserInfo(tenantId: string) {
    const result = await db.execute<{ id: string; name: string | null; email: string; role: WorkspaceRole }>(sql`
      select tm.user_id as id, u.name, u.email, tm.role
      from tenant_members tm
      join neon_auth."user" u on u.id::text = tm.user_id
      where tm.tenant_id = ${tenantId}
      order by u.name
    `);
    return result.rows;
  },
};
