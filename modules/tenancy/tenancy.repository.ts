import { db } from "@/lib/db";
import { tenantMembersTable, tenantsTable } from "./tenancy.schema";
import { and, eq, sql } from "drizzle-orm";

// Uses the unscoped `db`, not `withTenant`: resolving a user's tenant is what
// happens *before* a tenant is known, and tenants/tenant_members have no
// tenant RLS policy (see TENANCY.md).
export const tenancyRepository = {
  async findTenantIdByUserId(userId: string) {
    const member = await db.query.tenantMembersTable.findFirst({
      where: eq(tenantMembersTable.userId, userId),
    });
    return member?.tenantId;
  },

  async findMember(tenantId: string, userId: string) {
    return db.query.tenantMembersTable.findFirst({
      where: and(eq(tenantMembersTable.tenantId, tenantId), eq(tenantMembersTable.userId, userId)),
    });
  },

  /** Links a Neon Auth user to a tenant. `userId` is unique (one user = one tenant), so a second link is a conflict. */
  async insertMember(tenantId: string, userId: string) {
    const inserted = await db
      .insert(tenantMembersTable)
      .values({ tenantId, userId })
      .onConflictDoNothing({ target: tenantMembersTable.userId })
      .returning({ id: tenantMembersTable.id });
    return inserted.length > 0;
  },

  async findTenantById(id: string) {
    return db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.id, id),
    });
  },

  /** Every tenant — for background jobs that sweep all workspaces (there is no session/tenant to start from). */
  async findAllTenantIds() {
    const rows = await db.select({ id: tenantsTable.id }).from(tenantsTable);
    return rows.map((row) => row.id);
  },

  async findTenantBySlug(slug: string) {
    return db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.slug, slug),
    });
  },

  /**
   * Raw SQL, not a drizzle-schema join — `neon_auth.user` (name/email) is
   * managed by Neon Auth, not a table this app defines in its own drizzle
   * schema, so there's no `db.query.user` to join against. Same reasoning
   * as `getCurrentUser()` reading `session.user` directly instead of a
   * local `users` table. Used for the Activities "assigned to" picker.
   */
  async findMembersWithUserInfo(tenantId: string) {
    const result = await db.execute<{ id: string; name: string | null; email: string }>(sql`
      select tm.user_id as id, u.name, u.email
      from tenant_members tm
      join neon_auth."user" u on u.id::text = tm.user_id
      where tm.tenant_id = ${tenantId}
      order by u.name
    `);
    return result.rows;
  },
};
