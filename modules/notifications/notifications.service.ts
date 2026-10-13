import { UserFacingError } from "@/lib/errors";
import { isPushConfigured, sendPush } from "@/lib/web-push";
import { activitiesService } from "@/modules/activities/activities.service";
import { ACTIVITY_TYPE_LABELS } from "@/modules/activities/activities.types";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { teamService } from "@/modules/team/team.service";
import { tractionService } from "@/modules/traction/traction.service";
import { formatMeetingTime } from "@/modules/traction/traction.logic";
import { sendEmail } from "@/lib/email/send";
import { l10ReminderEmail, l10ReminderEmailText } from "@/lib/email/templates/l10-reminder";
import { crmUrl } from "@/lib/app-url";
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
        // Tasks are assigned to team people; only the ones with a login have devices to push to.
        const loginOf = new Map((await teamService.listPeople(tenantId)).map((p) => [p.id, p.userId]));

        for (const activity of due) {
          reminders += 1;
          const assigneeLogin = activity.assignedToPersonId ? loginOf.get(activity.assignedToPersonId) : undefined;
          const recipients = activity.assignedToPersonId ? (assigneeLogin ? [assigneeLogin] : []) : everyone;
          if (recipients.length === 0) continue; // assigned to someone with no login: no device to reach
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

  /**
   * One hour before each workspace's standing L10: a push to every teammate's devices (those with a login and
   * notifications on) and an email to every teammate with an address, carrying the meeting's points. Each meeting is
   * claimed once (tractionService.claimDueL10Reminders), so overlapping sweeps never send it twice.
   */
  async sendDueL10Reminders(now: Date = new Date()) {
    let meetings = 0;
    let pushed = 0;
    let emailed = 0;
    for (const reminder of await tractionService.claimDueL10Reminders(now)) {
      meetings += 1;
      const when = formatMeetingTime(reminder.meetingAt, reminder.timezone);
      const path = workspacePath(reminder.slug, "/traction/l10");
      if (isPushConfigured()) {
        const logins = reminder.people.map((p) => p.userId).filter((id): id is string => !!id);
        pushed += await deliver(await notificationsRepository.findByUserIds(logins), {
          title: `L10 in one hour · ${reminder.workspaceName}`,
          body: reminder.topIssues.length ? `Top issue: ${reminder.topIssues[0]}` : `${when}. Open the agenda.`,
          url: path,
          tag: `l10-${reminder.tenantId}`,
        });
      }
      const options = {
        workspaceName: reminder.workspaceName,
        when,
        meetingUrl: `${crmUrl()}${path}`,
        topIssues: reminder.topIssues,
        offGoal: reminder.offGoal,
        offTrackRocks: reminder.offTrackRocks,
        openTodos: reminder.openTodos,
      };
      for (const person of reminder.people) {
        if (!person.email) continue;
        const sent = await sendEmail({ to: person.email, subject: `L10 in one hour · ${reminder.workspaceName}`, html: l10ReminderEmail(options), text: l10ReminderEmailText(options) });
        if (sent) emailed += 1;
      }
    }
    return { meetings, pushed, emailed };
  },
};
