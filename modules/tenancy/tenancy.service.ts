import { UserFacingError } from "@/lib/errors";
import { tenancyRepository } from "./tenancy.repository";

export const tenancyService = {
  async getTenantIdForUser(userId: string) {
    const tenantId = await tenancyRepository.findTenantIdByUserId(userId);
    if (!tenantId) {
      throw new UserFacingError("This account isn't linked to a tenant yet.");
    }
    return tenantId;
  },

  async isMember(tenantId: string, userId: string) {
    return !!(await tenancyRepository.findMember(tenantId, userId));
  },

  async listMembers(tenantId: string) {
    return tenancyRepository.findMembersWithUserInfo(tenantId);
  },
};
