import { UserFacingError } from "@/lib/errors";
import { organizationsRepository } from "./organizations.repository";
import type { NewOrganization } from "./organizations.types";

export const organizationsService = {
  async listForTenant(tenantId: string) {
    return organizationsRepository.findAllForTenant(tenantId);
  },

  /** Created from a picker's "Create …" option — reuses a same-named org instead of duplicating it. */
  async create(tenantId: string, data: NewOrganization) {
    const existing = await organizationsRepository.findByName(tenantId, data.name);
    if (existing) return existing;
    return organizationsRepository.create(tenantId, data);
  },

  async update(tenantId: string, id: string, data: Partial<NewOrganization>) {
    const updated = await organizationsRepository.update(tenantId, id, data);
    if (!updated) {
      throw new UserFacingError("Organization not found.");
    }
    return updated;
  },
};
