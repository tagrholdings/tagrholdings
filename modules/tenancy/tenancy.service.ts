import { tenancyRepository } from "./tenancy.repository";

export const tenancyService = {
  async getTenantIdForUser(userId: string) {
    const tenantId = await tenancyRepository.findTenantIdByUserId(userId);
    if (!tenantId) {
      throw new Error("This account isn't linked to a tenant yet.");
    }
    return tenantId;
  },
};
