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

  /** Cross-checks a tenant id that came from OUTSIDE a session (an API caller, an env var) against a real tenant. */
  async tenantExists(tenantId: string) {
    return !!(await tenancyRepository.findTenantById(tenantId));
  },

  /** Gives an existing Neon Auth user access to a tenant. Throws if that user already belongs to a tenant. */
  async addMember(tenantId: string, userId: string) {
    if (!(await tenancyRepository.insertMember(tenantId, userId))) {
      throw new UserFacingError("This person already has access to a workspace.");
    }
  },

  async listTenantIds() {
    return tenancyRepository.findAllTenantIds();
  },

  async isMember(tenantId: string, userId: string) {
    return !!(await tenancyRepository.findMember(tenantId, userId));
  },

  async listMembers(tenantId: string) {
    return tenancyRepository.findMembersWithUserInfo(tenantId);
  },
};
