import { pipelineRepository } from "./pipeline.repository";

export const pipelineService = {
  async listForContact(tenantId: string, contactId: string) {
    return pipelineRepository.findByContactId(tenantId, contactId);
  },
};
