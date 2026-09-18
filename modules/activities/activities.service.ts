import { activitiesRepository } from "./activities.repository";
import type { NewActivity } from "./activities.types";

export const activitiesService = {
  async listForTenant(tenantId: string) {
    return activitiesRepository.findAllWithRelations(tenantId);
  },

  async create(tenantId: string, data: NewActivity) {
    return activitiesRepository.create(tenantId, data);
  },

  async setDone(tenantId: string, id: string, done: boolean) {
    const updated = await activitiesRepository.setDone(tenantId, id, done);
    if (!updated) {
      throw new Error("Activity not found.");
    }
    return updated;
  },

  async unlinkPipelineItems(tenantId: string, pipelineItemIds: string[]) {
    await activitiesRepository.unlinkPipelineItems(tenantId, pipelineItemIds);
  },

  async updateDate(tenantId: string, id: string, field: "dueDate" | "createdAt", date: Date) {
    const updated = await activitiesRepository.updateDate(tenantId, id, field, date);
    if (!updated) {
      throw new Error("Activity not found.");
    }
    return updated;
  },
};
