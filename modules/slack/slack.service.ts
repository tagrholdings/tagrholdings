import { crmUrl } from "@/lib/app-url";
import { UserFacingError } from "@/lib/errors";
import { GeminiUnavailable, generateGemini, type GenerateGemini } from "@/lib/gemini";
import { revalidateWorkspace } from "@/lib/revalidate";
import { workspacePath } from "@/lib/workspace-path";
import { activitiesService } from "@/modules/activities/activities.service";
import { createActivitySchema, updateActivitySchema } from "@/modules/activities/activities.types";
import { contactsService } from "@/modules/contacts/contacts.service";
import { createContactSchema } from "@/modules/contacts/contacts.types";
import { notificationsService } from "@/modules/notifications/notifications.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { createOrganizationSchema } from "@/modules/organizations/organizations.types";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { createPipelineItemSchema } from "@/modules/pipeline/pipeline.types";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import { teamService } from "@/modules/team/team.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { runAgent, type AgentData } from "./slack.agent";
import { CANCEL_ACTION_ID, CONFIRM_ACTION_ID, escapeMrkdwn, proposalBlocks, resolvedBlocks } from "./slack.blocks";
import { slackClient } from "./slack.client";
import { slackMessageText } from "./slack.logic";
import { slackInstallationsRepository } from "./slack-installations.repository";
import { slackRepository } from "./slack.repository";
import type { PendingPayload, ProposalFields, SlackInteractionPayload, SlackMessageEvent, SlackSettingsInput } from "./slack.types";

type Installation = Awaited<ReturnType<typeof slackInstallationsRepository.listForTeam>>[number];
type Tenant = NonNullable<Awaited<ReturnType<typeof tenancyService.getTenant>>>;

/** A card nobody pressed stops being valid after a day: a stale "Create" shouldn't fire next week. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const PER_PERSON_LIMIT = 30;
const PER_PERSON_WINDOW_MS = 10 * 60 * 1000;
const SWEEP_PROBABILITY = 0.05;
/** How much of a thread the agent is shown — enough for "change it", not a whole day's chat. */
const HISTORY_MESSAGES = 12;
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
    boards: once(() => pipelineService.listBoards(tenantId)),
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
    // Answers go in the thread: the message's own, or — for a reply inside a thread — the thread's root.
    const root = event.thread_ts ?? event.ts;
    const inThread = root !== event.ts;
    const reply = (text: string) => slackClient.postMessage({ channel: event.channel, text, threadTs: root }).catch((e) => console.error("slack: reply failed:", e));
    try {
      if (!event.user || event.bot_id) return;
      if (event.subtype && event.subtype !== "file_share") return;

      const installations = await slackInstallationsRepository.listForTeam(delivery.teamId, delivery.apiAppId);
      if (installations.length === 0) {
        console.warn(`slack: no workspace is connected to team ${delivery.teamId} / app ${delivery.apiAppId} — ignored.`);
        return;
      }

      // Addressed to the bot: a message in some workspace's command channel (a top-level one, or a reply inside a thread
      // the bot is already part of — checked below), or an @mention anywhere.
      const channelInstallation = installations.find((i) => i.commandChannelId === event.channel);
      if (!(event.type === "app_mention" || (event.type === "message" && channelInstallation))) return;
      if (!(await slackInstallationsRepository.claimMessage(delivery.apiAppId, event.channel, event.ts))) return;

      // A thread between people is none of the bot's business — settled before anything is said to anyone.
      const thread = inThread ? await slackClient.getThread(event.channel, root) : [];
      const botMessages = thread.filter((m) => m.app_id === delivery.apiAppId);
      if (event.type === "message" && inThread && botMessages.length === 0) return;

      // Which CRM workspace this is for: the channel's own, else the one the person belongs to.
      const person = await slackClient.getUser(event.user);
      const picked = await this.pickWorkspace(installations, channelInstallation, event.user, person.email);
      if ("ignore" in picked) return;
      if ("say" in picked) {
        await reply(picked.say);
        return;
      }
      const { tenant, userId } = picked;
      const tenantId = tenant.id;
      if (Math.random() < SWEEP_PROBABILITY) {
        await slackInstallationsRepository.deleteClaimsOlderThan(new Date(Date.now() - CLAIMS_MAX_AGE_MS));
        await slackRepository.deleteExpired(tenantId, new Date());
      }
      if (await rateLimitService.isLimited(`slack:${tenantId}:${event.user}`, PER_PERSON_LIMIT, PER_PERSON_WINDOW_MS)) {
        await reply("You're sending a lot of messages — give me a few minutes.");
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
      // What was said before in this thread: the people's messages and the bot's own (its cards included).
      const history = thread
        .filter((m) => m.ts !== event.ts && (m.app_id === delivery.apiAppId || (!m.bot_id && m.user)))
        .slice(-HISTORY_MESSAGES)
        .map((m) => ({ role: m.app_id === delivery.apiAppId ? ("assistant" as const) : ("user" as const), text: slackMessageText(m).replace(MENTION, "").trim() }));
      const outcome = await runAgent(
        { text, audio, history, timeZone: person.timeZone, now: new Date() },
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
      // The buttons carry the workspace too: a press names no channel-to-workspace mapping of its own.
      const card = proposalBlocks(outcome.payload, `${tenantId}.${pending.id}`, person.timeZone);
      const posted = await slackClient.postMessage({ channel: event.channel, threadTs: root, ...card });
      await slackRepository.setCardTs(tenantId, pending.id, posted.ts);

      // A correction of a card nobody pressed yet replaces it: two live cards for one request would be created twice.
      for (const old of await slackRepository.findPendingByCards(tenantId, event.channel, botMessages.map((m) => m.ts))) {
        if (old.id === pending.id || !old.cardTs) continue;
        if (await slackRepository.claimPending(tenantId, old.id, "cancelled")) {
          await slackClient.updateMessage({ channel: event.channel, ts: old.cardTs, ...resolvedBlocks("_Replaced by a newer proposal below._") }).catch((e) => console.error("slack: card update failed:", e));
        }
      }
    } catch (error) {
      console.error("slack: handling a message failed:", error);
      if (error instanceof GeminiUnavailable) await reply("My AI brain isn't reachable right now — try again in a minute, or add it in the CRM directly.");
      else await reply("Something went wrong on my side. Please try again.");
    }
  },

  /**
   * The CRM workspace a message is for. In a workspace's command channel it is that workspace; anywhere else (an @mention)
   * it is the one workspace the person belongs to — if they belong to several, they are told to use the channel of the one
   * they mean. A person who is nobody's member is refused (a test deployment can allow them, see allowUnlinkedUsers).
   */
  async pickWorkspace(
    installations: Installation[],
    channelInstallation: Installation | undefined,
    slackUserId: string,
    email: string | null
  ): Promise<{ tenant: Tenant; userId: string | null } | { say: string } | { ignore: true }> {
    const candidates = channelInstallation ? [channelInstallation] : installations;
    const live: { tenant: Tenant; installation: Installation }[] = [];
    for (const installation of candidates) {
      const tenant = await tenancyService.getTenant(installation.tenantId);
      if (tenant && !tenant.archivedAt) live.push({ tenant, installation });
    }
    if (live.length === 0) return { ignore: true };

    const allowed: { tenant: Tenant; userId: string | null; installation: Installation }[] = [];
    for (const { tenant, installation } of live) {
      const userId = await this.resolveLogin(tenant.id, slackUserId, email);
      if (userId || allowUnlinkedUsers()) allowed.push({ tenant, userId, installation });
    }
    if (allowed.length === 1) return { tenant: allowed[0].tenant, userId: allowed[0].userId };

    const who = `your Slack email${email ? ` (${email})` : ""}`;
    if (allowed.length === 0) {
      const where = live.length === 1 ? `a member of ${live[0].tenant.name}` : "a member of any workspace connected here";
      return { say: `I couldn't match ${who} to ${where}. Ask a workspace admin to add you, or to use the same email in Slack.` };
    }
    const channels = allowed.map((a) => (a.installation.commandChannelId ? `<#${a.installation.commandChannelId}> (${a.tenant.name})` : a.tenant.name)).join(", ");
    return { say: `You're in several workspaces, so tell me which one: write in its command channel — ${channels}.` };
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

    // The button value is "<workspace id>.<pending id>"; the workspace must be one this Slack team is connected to.
    const [tenantId, pendingId] = (action.value ?? "").split(".");
    if (!isUuid(tenantId) || !isUuid(pendingId)) return;
    if (!(await slackInstallationsRepository.find(delivery.teamId, delivery.apiAppId, tenantId))) return;
    const tenant = await tenancyService.getTenant(tenantId);
    if (!tenant || tenant.archivedAt) return;

    // Whoever presses must be a person of this workspace (the dev may press a card the boss asked for).
    const presser = await slackClient.getUser(slackUserId).catch(() => null);
    const presserLogin = presser ? await this.resolveLogin(tenantId, slackUserId, presser.email) : null;
    if (!presserLogin && !allowUnlinkedUsers()) {
      await say("Only members of this workspace can use these buttons.");
      return;
    }

    const pending = await slackRepository.findPending(tenantId, pendingId);
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

    if (payload.kind === "complete") {
      const activity = await activitiesService.setDone(tenantId, payload.id, payload.done);
      revalidateActivityPages(slug);
      return `✅ ${payload.done ? "Marked as done" : "Reopened"}: *${escapeMrkdwn(activity.subject)}* · ${link(activity.id)}`;
    }

    const page = (path: string) => `<${crmUrl()}${workspacePath(slug, path)}|Open in the CRM>`;

    if (payload.kind === "create_contact" || payload.kind === "update_contact") {
      const parsed = createContactSchema.safeParse(payload.fields);
      if (!parsed.success) invalid(parsed.error);
      const contact = payload.kind === "create_contact" ? await contactsService.create(tenantId, parsed.data) : await contactsService.update(tenantId, payload.id, parsed.data);
      revalidateActivityPages(slug);
      return `✅ ${payload.kind === "create_contact" ? "Created" : "Updated"} contact *${escapeMrkdwn(contact.name)}* · ${page("/contacts")}`;
    }

    if (payload.kind === "create_organization" || payload.kind === "update_organization") {
      // The organization form's own shape: an empty website is "", not null.
      const parsed = createOrganizationSchema.safeParse({ ...payload.fields, website: payload.fields.website ?? "" });
      if (!parsed.success) invalid(parsed.error);
      const organization = payload.kind === "create_organization" ? await organizationsService.create(tenantId, parsed.data) : await organizationsService.update(tenantId, payload.id, parsed.data);
      revalidateActivityPages(slug);
      return `✅ ${payload.kind === "create_organization" ? "Created" : "Updated"} company *${escapeMrkdwn(organization.name)}* · ${page("/contacts")}`;
    }

    const parsed = createPipelineItemSchema.safeParse(payload.fields);
    if (!parsed.success) invalid(parsed.error);
    const card = payload.kind === "create_card" ? await pipelineService.create(tenantId, parsed.data) : await pipelineService.update(tenantId, payload.id, parsed.data);
    revalidateActivityPages(slug);
    const where = payload.labels.isLead ? "/leads" : "/projects";
    return `✅ ${payload.kind === "create_card" ? "Created" : "Updated"} ${payload.labels.isLead ? "lead" : "project card"} *${escapeMrkdwn(card.title)}*${payload.labels.stage ? ` · ${escapeMrkdwn(payload.labels.stage)}` : ""} · ${page(where)}`;
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
    if (!saved) throw new UserFacingError("That channel is already the command channel of another workspace.");
  },
};
