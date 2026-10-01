import { UserFacingError } from "@/lib/errors";
import { isPushConfigured, sendPush } from "@/lib/web-push";
import { activitiesService } from "@/modules/activities/activities.service";
import { ACTIVITY_TYPE_LABELS } from "@/modules/activities/activities.types";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { workspacePath } from "@/lib/workspace-path";
import { notificationsRepository } from "./notifications.repository";
import { isAllowedPushEndpoint, type PushPayload, type SubscribePushInput } from "./notifications.types";

type Subscription = Awaited<ReturnType<typeof notificationsRepository.findByUserIds>>[number];

/** Sends one payload to a set of devices and forgets the ones the push service says are gone. Returns how many got it. */
async function deliver(subscriptions: Subscription[], payload: PushPayload): Promise<number> {
  const results = await Promise.all(
    subscriptions.map(async (sub) => ({ id: sub.id, result: await sendPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload) }))
  );
  await notificationsRepository.deleteByIds(results.filter((r) => r.result === "gone").map((r) => r.id));
  return results.filter((r) => r.result === "sent").length;
}

export const notificationsService = {
  async subscribe(userId: string, input: SubscribePushInput) {
    if (!isAllowedPushEndpoint(input.endpoint)) {
      throw new UserFacingError("This browser's notification service isn't supported.");
    }
    await notificationsRepository.upsert(userId, input);
  },

  async unsubscribe(userId: string, endpoint: string) {
    await notificationsRepository.deleteOwnByEndpoint(userId, endpoint);
  },

  /** A test push to every device the person has turned notifications on for. */
  async sendTest(userId: string, workspaceSlug: string) {
    if (!isPushConfigured()) throw new UserFacingError("Push notifications aren't set up on the server yet.");
    const subscriptions = await notificationsRepository.findByUserIds([userId]);
    if (subscriptions.length === 0) throw new UserFacingError("Turn notifications on for this device first.");
    const sent = await deliver(subscriptions, {
      title: "Notifications are on",
      body: "This is a test — task reminders will look like this.",
      url: workspacePath(workspaceSlug, "/settings/notifications"),
      tag: "test-notification",
    });
    if (sent === 0) throw new UserFacingError("The test couldn't be delivered. Turn notifications off and on again.");
    return { sent };
  },

  /**
   * The reminder sweep, run every few minutes by a scheduler (GitHub Actions → /api/cron/task-reminders).
   * For every workspace: take the reminders that came due (each is claimed exactly once), and push each one to
   * its assignee — or, when it isn't assigned to a team member, to everyone on the team.
   */
  async sendDueTaskReminders(now: Date = new Date()) {
    if (!isPushConfigured()) throw new Error("VAPID keys are not configured — no reminders can be sent.");

    let reminders = 0;
    let delivered = 0;
    for (const { id: tenantId, slug } of await tenancyService.listTenants()) {
      // One workspace failing must not stop the others' reminders.
      try {
        const due = await activitiesService.claimDueReminders(tenantId, now);
        if (due.length === 0) continue;
        const everyone = (await tenancyService.listMembers(tenantId)).map((member) => member.id);

        for (const activity of due) {
          reminders += 1;
          const recipients = activity.assignedToUserId ? [activity.assignedToUserId] : everyone;
          const subscriptions = await notificationsRepository.findByUserIds(recipients);
          delivered += await deliver(subscriptions, {
            title: activity.subject,
            body: `${ACTIVITY_TYPE_LABELS[activity.type as keyof typeof ACTIVITY_TYPE_LABELS] ?? "Task"} due now`,
            url: `${workspacePath(slug, "/activities")}?activity=${activity.id}`,
            tag: `activity-${activity.id}`,
          });
        }
      } catch (error) {
        console.error(`Task reminders failed for tenant ${tenantId}:`, error);
      }
    }
    return { reminders, delivered };
  },
};
