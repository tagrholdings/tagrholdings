import { UserFacingError } from "@/lib/errors";
import { teamService } from "@/modules/team/team.service";
import { activitiesRepository } from "./activities.repository";
import type { ActivityLink, ActivityUpdate, NewActivity } from "./activities.types";

const REMINDER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const activitiesService = {
  async listForTenant(tenantId: string) {
    return activitiesRepository.findAllWithRelations(tenantId);
  },

  /** `link` marks an L10 To-Do (Traction) and the issue it came from — set by tractionService, never by the activity form. */
  async create(tenantId: string, data: NewActivity, createdByUserId: string | null = null, link: ActivityLink = {}) {
    // Every link (contact, organization, pipeline item, team person) is a composite (tenant_id, x_id) foreign key;
    // an archived person is still a valid row, so that one is checked here.
    await teamService.assertActivePerson(tenantId, data.assignedToPersonId);
    return activitiesRepository.create(tenantId, data, createdByUserId, link);
  },

  async update(tenantId: string, data: ActivityUpdate) {
    await teamService.assertActivePerson(tenantId, data.assignedToPersonId);
    const updated = await activitiesRepository.update(tenantId, data);
    if (!updated) {
      throw new UserFacingError("Activity not found.");
    }
    return updated;
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

  async listL10Todos(tenantId: string, doneSince: Date) {
    return activitiesRepository.findL10Todos(tenantId, doneSince);
  },

  async unlinkIssue(tenantId: string, issueId: string) {
    await activitiesRepository.unlinkIssue(tenantId, issueId);
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
