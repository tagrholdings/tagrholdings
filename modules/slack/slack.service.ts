import { crmUrl } from "@/lib/app-url";
import { UserFacingError } from "@/lib/errors";
import { GeminiUnavailable, generateGemini, type GenerateGemini } from "@/lib/gemini";
import { revalidateWorkspace } from "@/lib/revalidate";
import { workspacePath } from "@/lib/workspace-path";
import { activitiesService } from "@/modules/activities/activities.service";
import { createActivitySchema, updateActivitySchema } from "@/modules/activities/activities.types";
import { contactsService } from "@/modules/contacts/contacts.service";
import { notificationsService } from "@/modules/notifications/notifications.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import { teamService } from "@/modules/team/team.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { runAgent, type AgentData } from "./slack.agent";
import { CANCEL_ACTION_ID, CONFIRM_ACTION_ID, escapeMrkdwn, proposalBlocks, resolvedBlocks } from "./slack.blocks";
import { slackClient } from "./slack.client";
import { slackInstallationsRepository } from "./slack-installations.repository";
import { slackRepository } from "./slack.repository";
import type { PendingPayload, ProposalFields, SlackInteractionPayload, SlackMessageEvent, SlackSettingsInput } from "./slack.types";

/** A card nobody pressed stops being valid after a day: a stale "Create" shouldn't fire next week. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const PER_PERSON_LIMIT = 30;
const PER_PERSON_WINDOW_MS = 10 * 60 * 1000;
const SWEEP_PROBABILITY = 0.05;
const CLAIMS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Delivery {
  teamId: string;
  apiAppId: string;
}

const MENTION = /<@[A-Z0-9]+>/g;

/**
 * Production refuses anyone whose Slack e-mail isn't a member of the workspace. A TEST deployment can switch that off
 * (SLACK_ALLOW_UNLINKED_USERS=true) so any Slack user in the dev app can try the bot; what they create then has no
 * creator. It is an explicit variable, not NODE_ENV: a Vercel preview runs with NODE_ENV=production too. Never set it in prod.
 */
const allowUnlinkedUsers = () => process.env.SLACK_ALLOW_UNLINKED_USERS === "true";
const isUuid = (value: string | undefined): value is string => !!value && /^[0-9a-f-]{36}$/i.test(value);

/** Loads each list at most once per message — the agent asks for what it needs, when it needs it. */
function dataFor(tenantId: string): AgentData {
  const once = <T>(load: () => Promise<T>) => {
    let cached: Promise<T> | undefined;
    return () => (cached ??= load());
  };
  return {
    people: once(() => teamService.listOptions(tenantId)),
    pipelineItems: once(() => pipelineService.listAllForTenant(tenantId)),
    contacts: once(() => contactsService.listForTenant(tenantId)),
    organizations: once(() => organizationsService.listForTenant(tenantId)),
    activities: once(() => activitiesService.listForTenant(tenantId)),
  };
}

/** The activity-shaped fields of a proposal → what the activity services validate (the due date back to a Date). */
function toActivityInput(fields: ProposalFields) {
  return { ...fields, dueDate: fields.dueDate ? new Date(fields.dueDate) : null };
}

function invalid(error: { issues: { message: string }[] }): never {
  throw new UserFacingError(error.issues[0]?.message ?? "That isn't a valid activity.");
}

/** Activities show up on these pages — the same list activities.actions.ts clears after its own writes. */
function revalidateActivityPages(slug: string) {
  revalidateWorkspace(slug, "/activities", "/traction/rocks", "/projects", "/leads", "/contacts");
}

export const slackService = {
  /**
   * A message in the command channel, or an @mention anywhere: understood by the agent, answered in the message's
   * thread. Never throws — it runs after the 200 has been sent, so a failure can only be logged and, where there is
   * someone to tell, said in the thread.
   */
  async handleMessage(event: SlackMessageEvent, delivery: Delivery, generate: GenerateGemini = generateGemini): Promise<void> {
    const reply = (text: string) => slackClient.postMessage({ channel: event.channel, text, threadTs: event.ts }).catch((e) => console.error("slack: reply failed:", e));
    try {
      if (!event.user || event.bot_id) return;
      if (event.subtype && event.subtype !== "file_share") return;

      const installation = await slackInstallationsRepository.find(delivery.teamId, delivery.apiAppId);
      if (!installation) {
        console.warn(`slack: no workspace is connected to team ${delivery.teamId} / app ${delivery.apiAppId} — ignored.`);
        return;
      }
      const tenant = await tenancyService.getTenant(installation.tenantId);
      if (!tenant || tenant.archivedAt) return;

      // Addressed to the bot: an @mention anywhere, or any top-level message in the command channel.
      const inCommandChannel = !!installation.commandChannelId && event.channel === installation.commandChannelId;
      const topLevel = !event.thread_ts || event.thread_ts === event.ts;
      if (!(event.type === "app_mention" || (event.type === "message" && inCommandChannel && topLevel))) return;
      if (!(await slackInstallationsRepository.claimMessage(delivery.apiAppId, event.channel, event.ts))) return;
      if (Math.random() < SWEEP_PROBABILITY) {
        await slackInstallationsRepository.deleteClaimsOlderThan(new Date(Date.now() - CLAIMS_MAX_AGE_MS));
        await slackRepository.deleteExpired(tenant.id, new Date());
      }

      const tenantId = tenant.id;
      if (await rateLimitService.isLimited(`slack:${tenantId}:${event.user}`, PER_PERSON_LIMIT, PER_PERSON_WINDOW_MS)) {
        await reply("You're sending a lot of messages — give me a few minutes.");
        return;
      }

      const person = await slackClient.getUser(event.user);
      const userId = await this.resolveLogin(tenantId, event.user, person.email);
      if (!userId && !allowUnlinkedUsers()) {
        await reply(`I couldn't match your Slack email${person.email ? ` (${person.email})` : ""} to a member of ${tenant.name}. Ask a workspace admin to add you, or to use the same email in Slack.`);
        return;
      }

      let audio;
      const file = event.files?.find((f) => f.mimetype?.startsWith("audio/") || f.mimetype?.startsWith("video/"));
      if (file) {
        const downloaded = await slackClient.downloadAudio(file);
        if (downloaded && "tooBig" in downloaded) {
          await reply("That recording is too long for me — send a shorter one (under about 10 minutes) or type it.");
          return;
        }
        audio = downloaded ?? undefined;
      }
      const text = (event.text ?? "").replace(MENTION, "").trim();
      if (!text && !audio) return;

      const sender = userId ? await teamService.personForUser(tenantId, userId) : null;
      const outcome = await runAgent(
        { text, audio, timeZone: person.timeZone, now: new Date() },
        { generate, data: dataFor(tenantId), userName: person.name, senderPersonId: sender?.id ?? null }
      );

      if (outcome.kind === "ignore") return;
      if (outcome.kind === "reply") {
        await reply(outcome.text);
        return;
      }
      const pending = await slackRepository.insertPending(tenantId, {
        slackUserId: event.user,
        payload: outcome.payload,
        channelId: event.channel,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      });
      const card = proposalBlocks(outcome.payload, pending.id, person.timeZone);
      const posted = await slackClient.postMessage({ channel: event.channel, threadTs: event.ts, ...card });
      await slackRepository.setCardTs(tenantId, pending.id, posted.ts);
    } catch (error) {
      console.error("slack: handling a message failed:", error);
      if (error instanceof GeminiUnavailable) await reply("My AI brain isn't reachable right now — try again in a minute, or add it in the CRM directly.");
      else await reply("Something went wrong on my side. Please try again.");
    }
  },

  /** Slack person → workspace login: the stored link if still valid, otherwise matched by e-mail (and remembered). */
  async resolveLogin(tenantId: string, slackUserId: string, email: string | null): Promise<string | null> {
    const link = await slackRepository.findLink(tenantId, slackUserId);
    if (link) {
      if (await tenancyService.isMember(tenantId, link.userId)) return link.userId;
      await slackRepository.deleteLink(tenantId, slackUserId);
    }
    if (!email) return null;
    const member = (await tenancyService.listMembers(tenantId)).find((m) => m.email?.toLowerCase() === email);
    if (!member) return null;
    await slackRepository.upsertLink(tenantId, slackUserId, member.id);
    return member.id;
  },

  /**
   * A press on Create / Save / Confirm / Cancel. The write comes from the stored proposal, never from the click, and a
   * card works once: it is claimed atomically before anything is written.
   */
  async handleInteraction(payload: SlackInteractionPayload, delivery: Delivery): Promise<void> {
    const action = payload.actions?.[0];
    const channel = payload.channel?.id;
    const cardTs = payload.message?.ts;
    const slackUserId = payload.user?.id;
    if (payload.type !== "block_actions" || !action || !channel || !cardTs || !slackUserId) return;
    if (action.action_id !== CONFIRM_ACTION_ID && action.action_id !== CANCEL_ACTION_ID) return;

    const update = (text: string) => slackClient.updateMessage({ channel, ts: cardTs, ...resolvedBlocks(text) }).catch((e) => console.error("slack: card update failed:", e));
    const say = (text: string) => slackClient.postMessage({ channel, text, threadTs: cardTs }).catch((e) => console.error("slack: reply failed:", e));

    const installation = await slackInstallationsRepository.find(delivery.teamId, delivery.apiAppId);
    if (!installation || !isUuid(action.value)) return;
    const tenantId = installation.tenantId;
    const tenant = await tenancyService.getTenant(tenantId);
    if (!tenant || tenant.archivedAt) return;

    // Whoever presses must be a person of this workspace (the dev may press a card the boss asked for).
    const presser = await slackClient.getUser(slackUserId).catch(() => null);
    const presserLogin = presser ? await this.resolveLogin(tenantId, slackUserId, presser.email) : null;
    if (!presserLogin && !allowUnlinkedUsers()) {
      await say("Only members of this workspace can use these buttons.");
      return;
    }

    const pending = await slackRepository.findPending(tenantId, action.value);
    if (!pending || pending.status !== "pending" || pending.expiresAt.getTime() < Date.now()) {
      await update(pending && pending.status === "done" ? "_Already handled._" : "_This request expired — ask me again._");
      return;
    }

    if (action.action_id === CANCEL_ACTION_ID) {
      if (await slackRepository.claimPending(tenantId, pending.id, "cancelled")) await update("_Cancelled._");
      return;
    }

    if (!(await slackRepository.claimPending(tenantId, pending.id, "done"))) return; // someone else pressed first
    try {
      const requester = await slackRepository.findLink(tenantId, pending.slackUserId);
      const result = await this.apply(tenantId, tenant.slug, pending.payload as PendingPayload, requester?.userId ?? presserLogin, presser?.name ?? null);
      await update(result);
    } catch (error) {
      // Nothing was written: the card goes back to pending so the same press can be retried.
      await slackRepository.releasePending(tenantId, pending.id);
      if (error instanceof UserFacingError) await say(`I couldn't do that: ${error.message}`);
      else {
        console.error("slack: applying a confirmed action failed:", error);
        await say("Something went wrong saving that. Press the button again, or add it in the CRM.");
      }
    }
  },

  /** Runs a confirmed proposal through the same services and rules the app uses; returns the card's final text. */
  async apply(tenantId: string, slug: string, payload: PendingPayload, userId: string | null, actorName: string | null): Promise<string> {
    const actor = { id: userId ?? "slack", name: actorName };
    const link = (id: string) => `<${crmUrl()}${workspacePath(slug, "/activities")}?activity=${id}|Open in the CRM>`;

    if (payload.kind === "create") {
      const parsed = createActivitySchema.safeParse(toActivityInput(payload.fields));
      if (!parsed.success) invalid(parsed.error);
      const activity = await activitiesService.create(tenantId, parsed.data, userId);
      revalidateActivityPages(slug);
      await notificationsService.notifyAssigned(tenantId, slug, [activity], actor);
      return `✅ Created *${escapeMrkdwn(activity.subject)}* · ${link(activity.id)}`;
    }

    if (payload.kind === "update") {
      const parsed = updateActivitySchema.safeParse({ ...toActivityInput(payload.fields), id: payload.id });
      if (!parsed.success) invalid(parsed.error);
      const { previousAssignedToPersonId, ...activity } = await activitiesService.update(tenantId, parsed.data);
      revalidateActivityPages(slug);
      // Only a hand-over is news to the assignee, as in the app's own edit action.
      if (activity.assignedToPersonId !== previousAssignedToPersonId) await notificationsService.notifyAssigned(tenantId, slug, [activity], actor);
      return `✅ Updated *${escapeMrkdwn(activity.subject)}* · ${link(activity.id)}`;
    }

    const activity = await activitiesService.setDone(tenantId, payload.id, payload.done);
    revalidateActivityPages(slug);
    return `✅ ${payload.done ? "Marked as done" : "Reopened"}: *${escapeMrkdwn(activity.subject)}* · ${link(activity.id)}`;
  },

  // -- the settings page ---------------------------------------------------------------------------------------------

  /** What an admin sees: this environment's app, what is connected, and who has been matched. */
  async getSettings(tenantId: string) {
    const apiAppId = process.env.SLACK_APP_ID?.trim() || null;
    const [installation, links, members] = await Promise.all([
      apiAppId ? slackInstallationsRepository.findForTenant(tenantId, apiAppId) : undefined,
      slackRepository.findLinks(tenantId),
      tenancyService.listMembers(tenantId),
    ]);
    const nameOf = new Map(members.map((m) => [m.id, m.name || m.email]));
    return {
      server: {
        appId: !!apiAppId,
        botToken: !!process.env.SLACK_BOT_TOKEN,
        signingSecret: !!process.env.SLACK_SIGNING_SECRET,
        gemini: !!process.env.GEMINI_API_KEY,
      },
      slackTeamId: installation?.slackTeamId ?? "",
      commandChannelId: installation?.commandChannelId ?? "",
      linked: links.map((l) => ({ slackUserId: l.slackUserId, name: nameOf.get(l.userId) ?? "Former member" })),
    };
  },

  async saveSettings(tenantId: string, input: SlackSettingsInput) {
    const apiAppId = process.env.SLACK_APP_ID?.trim();
    if (!apiAppId) throw new UserFacingError("SLACK_APP_ID isn't set on the server yet.");
    const saved = await slackInstallationsRepository.upsertForTenant(tenantId, apiAppId, {
      slackTeamId: input.slackTeamId.trim(),
      commandChannelId: input.commandChannelId?.trim() || null,
    });
    if (!saved) throw new UserFacingError("That Slack workspace is already connected to another workspace.");
  },
};
