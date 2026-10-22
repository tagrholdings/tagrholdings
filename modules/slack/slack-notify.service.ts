import { crmUrl } from "@/lib/app-url";
import { workspacePath } from "@/lib/workspace-path";
import { ACTIVITY_TYPE_LABELS } from "@/modules/activities/activities.types";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { formatDateUS, toZonedInputValues } from "@/utils/date";
import { activitiesService } from "@/modules/activities/activities.service";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { leadsService } from "@/modules/leads/leads.service";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { teamService } from "@/modules/team/team.service";
import { tractionService } from "@/modules/traction/traction.service";
import { FIT_RANK } from "@/modules/search-profiles/fit";
import { assignedMessage, digestMessage, l10Message, leadMessage, moreLeadsMessage, reminderMessage, weeklyReportMessage, type DigestItem, type Message, type WeeklyReport } from "./slack.notify-blocks";
import { dueDay, addDays } from "./slack.logic";
import { summarizePipeline } from "./slack.reports";
import { slackClient } from "./slack.client";
import { slackInstallationsRepository } from "./slack-installations.repository";
import { slackRepository } from "./slack.repository";

/**
 * What the bot says on its own. Everything here runs inside someone else's flow (the reminder sweep, a task being
 * assigned, the L10 reminder) or inside the notification sweep, so NOTHING throws: a Slack problem is logged and never
 * stops a push, an e-mail or the save that triggered it.
 *
 * Who can be messaged: a workspace member whose e-mail is a Slack person. They are found once (users.lookupByEmail) and
 * remembered in slack_user_links, where they also hold what they chose to be messaged about.
 */

/** A member whose Slack lookup found nobody is not asked again for an hour — a sweep runs every 20 minutes. */
const LOOKUP_MISS_TTL_MS = 60 * 60 * 1000;
const lookupMisses = new Map<string, number>();

type Link = NonNullable<Awaited<ReturnType<typeof slackRepository.findLink>>>;
export interface Recipient {
  slackUserId: string;
  link: Link;
}

export const slackConfigured = () => !!process.env.SLACK_BOT_TOKEN && !!process.env.SLACK_APP_ID?.trim();

const typeLabel = (type: string) => ACTIVITY_TYPE_LABELS[type as keyof typeof ACTIVITY_TYPE_LABELS] ?? "Task";
const appUrl = (slug: string, path: string) => `${crmUrl()}${workspacePath(slug, path)}`;

/** Whether this CRM workspace is connected to Slack through this environment's app. */
async function isConnected(tenantId: string): Promise<boolean> {
  if (!slackConfigured()) return false;
  return !!(await slackInstallationsRepository.findForTenant(tenantId, process.env.SLACK_APP_ID!.trim()));
}

/** What a sweep may send at most: it runs inside a cron request. What is left is picked up by the next sweep. */
const SWEEP_MESSAGE_BUDGET = 40;
/** Only leads from the last day are announced — switching this on must not flood a channel with an old backlog. */
const NEW_LEAD_WINDOW_MS = 24 * 60 * 60 * 1000;
const LEAD_CARDS_PER_WORKSPACE = 5;

/** The morning summary goes out in this local hour (08:00–08:59); a sweep every 20 minutes always lands in it. */
const DIGEST_HOUR = "08";
/** The weekly report goes out on Monday, from this local time. */
const WEEKLY_FROM = "08:00";
const DEFAULT_REPORT_ZONE = "America/Phoenix";

const SOURCE_LABELS: Record<string, string> = {
  google_places: "Google Places",
  brave_search: "Web search",
  marketplace_scrape: "Marketplace",
  broker_listings: "Broker listing",
  company_site_scrape: "Company site",
  email_digest: "Email",
  manual_assist: "Added by hand",
};

export const slackNotifyService = {
  configured: slackConfigured,

  /**
   * The sweep, called from the cron route every 20 minutes. Never throws and sends at most SWEEP_MESSAGE_BUDGET messages;
   * every kind of message is claimed in slack_sent_claims first, so overlapping sweeps never repeat one.
   */
  async sweep(now: Date = new Date()): Promise<{ leads: number; digests: number; weekly: number }> {
    const result = { leads: 0, digests: 0, weekly: 0 };
    if (!slackConfigured()) return result;
    try {
      let budget = SWEEP_MESSAGE_BUDGET;
      const installations = await slackInstallationsRepository.listForApp(process.env.SLACK_APP_ID!.trim());
      for (const installation of installations) {
        if (budget <= 0) break;
        const tenant = await tenancyService.getTenant(installation.tenantId);
        if (!tenant || tenant.archivedAt) continue;
        try {
          let sent = await this.announceNewLeads(tenant, installation.commandChannelId, now, budget);
          result.leads += sent;
          budget -= sent;
          sent = await this.sendDigests(tenant, now, budget);
          result.digests += sent;
          budget -= sent;
          sent = await this.sendWeeklyReport(tenant, now, budget);
          result.weekly += sent;
          budget -= sent;
        } catch (error) {
          console.error(`slack: sweep failed for workspace ${tenant.id}:`, error);
        }
      }
    } catch (error) {
      console.error("slack: sweep failed:", error);
    }
    return result;
  },

  /**
   * The morning summary, for each person who asked for it (digestDm) whose local time is between 8:00 and 9:00: what is due
   * today and what is overdue, from THEIR tasks. Claimed per person per local day. Nothing is sent when they have nothing due.
   */
  async sendDigests(tenant: { id: string; slug: string }, now: Date, budget: number): Promise<number> {
    const candidates = (await slackRepository.findLinks(tenant.id)).filter((l) => l.digestDm && l.timeZone && toZonedInputValues(now, l.timeZone).time.startsWith(DIGEST_HOUR));
    if (candidates.length === 0 || budget <= 0) return 0;

    const activities = await activitiesService.listForTenant(tenant.id);
    let sent = 0;
    for (const link of candidates) {
      if (sent >= budget) break;
      const zone = link.timeZone!;
      const today = toZonedInputValues(now, zone).date;
      if (!(await slackInstallationsRepository.claimSend(`digest:${tenant.id}:${link.slackUserId}:${today}`))) continue;
      if (!(await tenancyService.isMember(tenant.id, link.userId))) continue;
      const person = await teamService.personForUser(tenant.id, link.userId);
      if (!person) continue;

      const mine = activities.filter((a) => !a.done && a.assignedToPersonId === person.id && a.dueDate);
      const item = (a: (typeof mine)[number]): DigestItem => ({ subject: a.subject, time: a.timezone ? new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(new Date(a.dueDate!)) : null });
      const dueToday = mine.filter((a) => dueDay(a.dueDate!, a.timezone, zone) === today).map(item);
      const overdue = mine.filter((a) => dueDay(a.dueDate!, a.timezone, zone) < today).map(item);
      if (dueToday.length + overdue.length === 0) continue;
      if (await this.send(link.slackUserId, digestMessage({ today: dueToday, overdue, url: appUrl(tenant.slug, "/activities") }))) sent += 1;
    }
    return sent;
  },

  /**
   * The numbers behind the weekly report, as of `now` in `timeZone`: the pipeline (per stage, new, stuck), tasks, how the
   * week's leads were handled, and the EOS overview. Used by the Monday DM and by "send me the report".
   */
  async buildWeeklyReport(tenant: { id: string; name: string }, now: Date, timeZone: string): Promise<WeeklyReport> {
    const [items, boards, activities, leads, newLeads, spend, traction] = await Promise.all([
      pipelineService.listAllForTenant(tenant.id),
      pipelineService.listBoards(tenant.id),
      activitiesService.listForTenant(tenant.id),
      leadsService.listForTenant(tenant.id),
      leadsService.countNew(tenant.id),
      leadEngineService.getSpendTotals(tenant.id, now).catch(() => null),
      tractionService.getSummary(tenant.id, now).catch(() => null),
    ]);
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const lastWeek = leads.filter((l) => new Date(l.createdAt).getTime() >= weekAgo);
    const today = toZonedInputValues(now, timeZone).date;
    const label = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
    return {
      workspaceName: tenant.name,
      period: `${label(addDays(today, -7))} – ${label(today)}`,
      pipeline: summarizePipeline({ items, boards, activities, newLeads, now, timeZone }),
      leads: {
        arrived: lastWeek.length,
        added: lastWeek.filter((l) => l.status === "processed").length,
        dismissed: lastWeek.filter((l) => l.status === "dismissed").length,
        waiting: newLeads,
        engineCostUsd: spend?.last7DaysUsd ?? 0,
      },
      traction: traction ? { scorecard: traction.scorecard, rocks: traction.rocks, openIssues: traction.openIssues, todos: traction.todos } : null,
    };
  },

  /**
   * Monday morning (from 8:00 in the workspace's L10 zone), once a week: the report as a DM to every workspace ADMIN who is on
   * Slack and kept it on. Claimed only once there is someone to send it to, so a Monday with no reachable admin isn't spent.
   */
  async sendWeeklyReport(tenant: { id: string; slug: string; name: string }, now: Date, budget: number): Promise<number> {
    if (budget <= 0) return 0;
    const schedule = await tractionService.getL10Schedule(tenant.id, now).catch(() => null);
    const zone = schedule?.timezone ?? DEFAULT_REPORT_ZONE;
    const local = toZonedInputValues(now, zone);
    const isMonday = new Date(`${local.date}T00:00:00Z`).getUTCDay() === 1;
    if (!isMonday || local.time < WEEKLY_FROM) return 0;

    const admins = (await tenancyService.listMembers(tenant.id)).filter((m) => m.role === "admin").map((m) => m.id);
    const recipients = [...(await this.resolveRecipients(tenant.id, admins)).values()].filter((r) => r.link.weeklyDm).slice(0, budget);
    if (recipients.length === 0) return 0;
    if (!(await slackInstallationsRepository.claimSend(`weekly:${tenant.id}:${local.date}`))) return 0;

    const message = weeklyReportMessage(await this.buildWeeklyReport(tenant, now, zone), { pipeline: appUrl(tenant.slug, "/leads"), traction: appUrl(tenant.slug, "/traction") });
    let sent = 0;
    for (const { slackUserId } of recipients) if (await this.send(slackUserId, message)) sent += 1;
    return sent;
  },

  /** New leads from the last day, as cards in the workspace's command channel: the best five, then "and N more". */
  async announceNewLeads(tenant: { id: string; slug: string }, channel: string | null, now: Date, budget: number): Promise<number> {
    if (!channel) return 0;
    const recent = await leadsService.listNewSince(tenant.id, new Date(now.getTime() - NEW_LEAD_WINDOW_MS));
    if (recent.length === 0) return 0;

    const fresh = [];
    for (const lead of recent) if (await slackInstallationsRepository.claimSend(`lead:${lead.id}`)) fresh.push(lead);
    if (fresh.length === 0) return 0;

    // Best fit first (then newest, which is the order they came in).
    fresh.sort((a, b) => FIT_RANK[a.fit?.status ?? "none"] - FIT_RANK[b.fit?.status ?? "none"]);
    let sent = 0;
    for (const lead of fresh.slice(0, Math.min(LEAD_CARDS_PER_WORKSPACE, budget))) {
      const fields = lead.extractedFields;
      const place = [fields.location?.city, fields.location?.state].filter(Boolean).join(", ");
      const message = leadMessage({
        businessName: lead.businessName,
        source: SOURCE_LABELS[lead.sourceType] ?? lead.sourceType,
        fit: lead.fit?.status ?? null,
        askingPrice: fields.askingPrice ?? null,
        revenue: fields.estimatedRevenue ?? null,
        place: place || null,
        summary: fields.summary ?? null,
        sourceUrl: lead.sourceUrl,
        value: `${tenant.id}.${lead.id}`,
      });
      try {
        await slackClient.postMessage({ channel, ...message });
        sent += 1;
      } catch (error) {
        console.error("slack: posting a lead card failed:", error);
      }
    }
    const rest = fresh.length - Math.min(LEAD_CARDS_PER_WORKSPACE, budget);
    if (rest > 0 && sent < budget) {
      await slackClient.postMessage({ channel, ...moreLeadsMessage(rest, appUrl(tenant.slug, "/sourcing")) }).catch((error) => console.error("slack: posting the lead summary failed:", error));
      sent += 1;
    }
    return sent;
  },

  /**
   * The Slack people for these workspace logins. Members already linked come straight from slack_user_links; the others
   * are looked up by e-mail and linked. A login with no Slack account is simply absent from the result.
   */
  async resolveRecipients(tenantId: string, userIds: string[]): Promise<Map<string, Recipient>> {
    const found = new Map<string, Recipient>();
    try {
      if (userIds.length === 0 || !(await isConnected(tenantId))) return found;
      const wanted = new Set(userIds);
      for (const link of await slackRepository.findLinks(tenantId)) if (wanted.has(link.userId)) found.set(link.userId, { slackUserId: link.slackUserId, link });

      const missing = userIds.filter((id) => !found.has(id));
      if (missing.length === 0) return found;
      const members = new Map((await tenancyService.listMembers(tenantId)).map((m) => [m.id, m]));
      for (const userId of missing) {
        const email = members.get(userId)?.email?.toLowerCase();
        const missKey = `${tenantId}:${userId}`;
        if (!email || (lookupMisses.get(missKey) ?? 0) > Date.now() - LOOKUP_MISS_TTL_MS) continue;
        const person = await slackClient.lookupByEmail(email);
        if (!person) {
          lookupMisses.set(missKey, Date.now());
          continue;
        }
        await slackRepository.upsertLink(tenantId, person.id, userId, person.timeZone);
        const link = await slackRepository.findLink(tenantId, person.id);
        if (link) found.set(userId, { slackUserId: person.id, link });
      }
    } catch (error) {
      console.error("slack: finding who to message failed:", error);
    }
    return found;
  },

  /** One DM; false (and a log line) when Slack refused it. */
  async send(slackUserId: string, message: Message): Promise<boolean> {
    try {
      await slackClient.postDm(slackUserId, message);
      return true;
    } catch (error) {
      console.error("slack: sending a direct message failed:", error);
      return false;
    }
  },

  /** "⏰ X is due now" to everyone who should hear about this reminder (those who didn't turn Slack reminders off). */
  async dmReminder(tenantId: string, slug: string, activity: { id: string; type: string; subject: string }, userIds: string[]): Promise<number> {
    const recipients = await this.resolveRecipients(tenantId, userIds);
    const message = reminderMessage({ subject: activity.subject, typeLabel: typeLabel(activity.type), value: `${tenantId}.${activity.id}`, url: `${appUrl(slug, "/activities")}?activity=${activity.id}` });
    let sent = 0;
    for (const { slackUserId, link } of recipients.values()) if (link.remindDm && (await this.send(slackUserId, message))) sent += 1;
    return sent;
  },

  /** "📌 New task for you" to the assignee. Not when they assigned it to themselves (the caller checks) or turned reminders off. */
  async dmAssigned(
    tenantId: string,
    slug: string,
    activity: { id: string; type: string; subject: string; dueDate: Date | string | null },
    assigneeUserId: string,
    actorName: string | null
  ): Promise<boolean> {
    const recipient = (await this.resolveRecipients(tenantId, [assigneeUserId])).get(assigneeUserId);
    if (!recipient?.link.remindDm) return false;
    const due = activity.dueDate ? formatDateUS(activity.dueDate, { weekday: "short", month: "short", day: "numeric" }) : null;
    return this.send(
      recipient.slackUserId,
      assignedMessage({ subject: activity.subject, typeLabel: typeLabel(activity.type), due, from: actorName, value: `${tenantId}.${activity.id}`, url: `${appUrl(slug, "/activities")}?activity=${activity.id}` })
    );
  },

  /** The L10 reminder, one DM per teammate (those who didn't turn it off). Returns how many went out. */
  async dmL10(
    reminder: { tenantId: string; slug: string; workspaceName: string; topIssues: string[]; offGoal: string[]; offTrackRocks: string[]; openTodos: number; people: { userId: string | null }[] },
    when: string
  ): Promise<number> {
    const logins = reminder.people.map((p) => p.userId).filter((id): id is string => !!id);
    const recipients = await this.resolveRecipients(reminder.tenantId, logins);
    const message = l10Message({ ...reminder, when, url: appUrl(reminder.slug, "/traction/l10") });
    let sent = 0;
    for (const { slackUserId, link } of recipients.values()) if (link.l10Dm && (await this.send(slackUserId, message))) sent += 1;
    return sent;
  },
};
