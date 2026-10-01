import { db } from "@/lib/db";
import { platformRolesTable, tenantMembersTable, tenantsTable } from "./tenancy.schema";
import { and, asc, eq, sql } from "drizzle-orm";
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

  /** Every workspace — for background jobs that sweep all of them (there is no session/tenant to start from) and for the super admin. */
  async findAllTenants() {
    return db.select({ id: tenantsTable.id, slug: tenantsTable.slug, name: tenantsTable.name }).from(tenantsTable).orderBy(asc(tenantsTable.name));
  },

  /** The workspaces a person belongs to, with their role in each. */
  async findWorkspacesForUser(userId: string) {
    return db
      .select({ id: tenantsTable.id, slug: tenantsTable.slug, name: tenantsTable.name, role: tenantMembersTable.role })
      .from(tenantMembersTable)
      .innerJoin(tenantsTable, eq(tenantsTable.id, tenantMembersTable.tenantId))
      .where(eq(tenantMembersTable.userId, userId))
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
