import { UserFacingError } from "@/lib/errors";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { activitiesRepository } from "./activities.repository";
import type { NewActivity } from "./activities.types";

const REMINDER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const activitiesService = {
  async listForTenant(tenantId: string) {
    return activitiesRepository.findAllWithRelations(tenantId);
  },

  async create(tenantId: string, data: NewActivity) {
    // contact/organization/pipeline-item links are enforced by composite
    // (tenant_id, x_id) foreign keys; the assignee is a Neon Auth user id with
    // no FK possible, so its tenant membership is checked here.
    if (data.assignedToUserId && !(await tenancyService.isMember(tenantId, data.assignedToUserId))) {
      throw new UserFacingError("That team member isn't part of this workspace.");
    }
    return activitiesRepository.create(tenantId, data);
  },

  async setDone(tenantId: string, id: string, done: boolean) {
    const updated = await activitiesRepository.setDone(tenantId, id, done);
    if (!updated) {
      throw new UserFacingError("Activity not found.");
    }
    return updated;
  },

  /** Reminders due now, marked as sent. Anything more than a day overdue is dropped rather than sent late. */
  async claimDueReminders(tenantId: string, now: Date = new Date()) {
    return activitiesRepository.claimDueReminders(tenantId, now, new Date(now.getTime() - REMINDER_MAX_AGE_MS));
  },

  async unlinkPipelineItems(tenantId: string, pipelineItemIds: string[]) {
    await activitiesRepository.unlinkPipelineItems(tenantId, pipelineItemIds);
  },

  async updateDate(tenantId: string, id: string, field: "dueDate" | "createdAt", date: Date) {
    const updated = await activitiesRepository.updateDate(tenantId, id, field, date);
    if (!updated) {
      throw new UserFacingError("Activity not found.");
    }
    return updated;
  },
};
