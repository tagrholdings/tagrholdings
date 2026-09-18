import { activitiesRepository } from "./activities.repository";

export const activitiesService = {
  async listForContact(tenantId: string, contactId: string) {
    return activitiesRepository.findByContactId(tenantId, contactId);
  },
};
