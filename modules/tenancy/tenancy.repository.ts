import { db } from "@/lib/db";
import { tenantMembersTable, tenantsTable } from "./tenancy.schema";
import { eq } from "drizzle-orm";

export const tenancyRepository = {
  async findTenantIdByUserId(userId: string) {
    const member = await db.query.tenantMembersTable.findFirst({
      where: eq(tenantMembersTable.userId, userId),
    });
    return member?.tenantId;
  },

  async findTenantBySlug(slug: string) {
    return db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.slug, slug),
    });
  },
};
