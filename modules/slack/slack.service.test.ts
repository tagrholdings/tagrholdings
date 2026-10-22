import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserFacingError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  installations: { listForTeam: vi.fn(), find: vi.fn(), claimMessage: vi.fn(), deleteClaimsOlderThan: vi.fn() },
  repo: { findLink: vi.fn(), upsertLink: vi.fn(), deleteLink: vi.fn(), insertPending: vi.fn(), setCardTs: vi.fn(), findPending: vi.fn(), findPendingByCards: vi.fn(), claimPending: vi.fn(), releasePending: vi.fn(), deleteExpired: vi.fn() },
  client: { postMessage: vi.fn(), updateMessage: vi.fn(), getUser: vi.fn(), getThread: vi.fn(), downloadAudio: vi.fn() },
  tenancy: { getTenant: vi.fn(), isMember: vi.fn(), listMembers: vi.fn() },
  team: { personForUser: vi.fn() },
  activities: { create: vi.fn(), update: vi.fn(), setDone: vi.fn() },
  notifications: { notifyAssigned: vi.fn() },
  rateLimit: { isLimited: vi.fn() },
  agent: { runAgent: vi.fn() },
  contacts: { create: vi.fn(), update: vi.fn() },
  organizations: { create: vi.fn(), update: vi.fn() },
  pipeline: { create: vi.fn(), update: vi.fn() },
}));

vi.mock("./slack-installations.repository", () => ({ slackInstallationsRepository: mocks.installations }));
vi.mock("./slack.repository", () => ({ slackRepository: mocks.repo }));
vi.mock("./slack.client", () => ({ slackClient: mocks.client }));
vi.mock("./slack.agent", () => ({ runAgent: mocks.agent.runAgent }));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: mocks.tenancy }));
vi.mock("@/modules/team/team.service", () => ({ teamService: mocks.team }));
vi.mock("@/modules/activities/activities.service", () => ({ activitiesService: mocks.activities }));
vi.mock("@/modules/notifications/notifications.service", () => ({ notificationsService: mocks.notifications }));
vi.mock("@/modules/rate-limit/rate-limit.service", () => ({ rateLimitService: mocks.rateLimit }));
vi.mock("@/modules/contacts/contacts.service", () => ({ contactsService: mocks.contacts }));
vi.mock("@/modules/organizations/organizations.service", () => ({ organizationsService: mocks.organizations }));
vi.mock("@/modules/pipeline/pipeline.service", () => ({ pipelineService: mocks.pipeline }));
vi.mock("@/lib/revalidate", () => ({ revalidateWorkspace: vi.fn() }));
vi.mock("@/lib/gemini", () => ({ generateGemini: vi.fn(), GeminiUnavailable: class extends Error {} }));

import { slackService } from "./slack.service";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PENDING = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const delivery = { teamId: "T1", apiAppId: "A1" };
const message = { type: "message" as const, user: "U1", text: "call João tomorrow", ts: "1.1", channel: "C1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.installations.listForTeam.mockResolvedValue([{ tenantId: TENANT, commandChannelId: "C1" }]);
  mocks.installations.find.mockResolvedValue({ tenantId: TENANT, commandChannelId: "C1" });
  mocks.installations.claimMessage.mockResolvedValue(true);
  mocks.tenancy.getTenant.mockResolvedValue({ id: TENANT, slug: "tagr", name: "Tagr", archivedAt: null });
  mocks.tenancy.isMember.mockResolvedValue(true);
  mocks.rateLimit.isLimited.mockResolvedValue(false);
  mocks.client.getUser.mockResolvedValue({ email: "boss@tagr.com", name: "Boss", timeZone: "America/Phoenix" });
  mocks.client.postMessage.mockResolvedValue({ ts: "2.2" });
  mocks.client.updateMessage.mockResolvedValue(undefined);
  mocks.client.getThread.mockResolvedValue([]);
  mocks.repo.findPendingByCards.mockResolvedValue([]);
  mocks.repo.findLink.mockResolvedValue({ userId: "user-1" });
  mocks.team.personForUser.mockResolvedValue({ id: "person-1" });
});

describe("handleMessage", () => {
  it("ignores a team with no connected workspace", async () => {
    mocks.installations.listForTeam.mockResolvedValue([]);
    await slackService.handleMessage(message, delivery);
    expect(mocks.agent.runAgent).not.toHaveBeenCalled();
    expect(mocks.client.postMessage).not.toHaveBeenCalled();
  });

  it("ignores chatter outside the command channel unless the bot is mentioned", async () => {
    await slackService.handleMessage({ ...message, channel: "C-other" }, delivery);
    expect(mocks.agent.runAgent).not.toHaveBeenCalled();
    mocks.agent.runAgent.mockResolvedValue({ kind: "ignore" });
    await slackService.handleMessage({ ...message, type: "app_mention", channel: "C-other", text: "<@UBOT> call João" }, delivery);
    expect(mocks.agent.runAgent).toHaveBeenCalledTimes(1);
    expect(mocks.agent.runAgent.mock.calls[0][0].text).toBe("call João");
  });

  it("ignores bots and edits, and processes a message only once", async () => {
    await slackService.handleMessage({ ...message, bot_id: "B1" }, delivery);
    await slackService.handleMessage({ ...message, subtype: "message_changed" }, delivery);
    mocks.installations.claimMessage.mockResolvedValue(false);
    await slackService.handleMessage(message, delivery);
    expect(mocks.agent.runAgent).not.toHaveBeenCalled();
  });

  describe("threads", () => {
    const reply = { ...message, ts: "5.5", thread_ts: "1.1", text: "change it to friday" };
    const people = { ts: "1.1", user: "U1", text: "call João tomorrow" };
    const bot = { ts: "2.2", app_id: "A1", bot_id: "B1", text: "New call: Call João", blocks: [{ type: "section", text: { type: "mrkdwn", text: "New call: *Call João*" } }, { type: "section", fields: [{ type: "mrkdwn", text: "*Due*\nThu, Oct 22" }] }] };

    it("ignores a reply in a thread the bot is not part of (people talking)", async () => {
      mocks.client.getThread.mockResolvedValue([people, { ts: "3.3", user: "U2", text: "sure" }, reply]);
      await slackService.handleMessage(reply, delivery);
      expect(mocks.agent.runAgent).not.toHaveBeenCalled();
      expect(mocks.client.postMessage).not.toHaveBeenCalled();
    });

    it("continues a thread the bot is in: earlier turns go to the agent and the answer goes to the thread's root", async () => {
      mocks.client.getThread.mockResolvedValue([people, bot, reply]);
      mocks.agent.runAgent.mockResolvedValue({ kind: "reply", text: "done" });
      await slackService.handleMessage(reply, delivery);
      const input = mocks.agent.runAgent.mock.calls[0][0];
      expect(input.text).toBe("change it to friday");
      expect(input.history).toEqual([
        { role: "user", text: "call João tomorrow" },
        { role: "assistant", text: "New call: Call João\nDue: Thu, Oct 22" },
      ]);
      expect(mocks.client.postMessage).toHaveBeenCalledWith({ channel: "C1", text: "done", threadTs: "1.1" });
    });

    it("a new proposal replaces the earlier card nobody pressed", async () => {
      mocks.client.getThread.mockResolvedValue([people, bot, reply]);
      mocks.agent.runAgent.mockResolvedValue({ kind: "propose", payload: { kind: "complete", id: "x", subject: "Call João", done: true } });
      mocks.repo.insertPending.mockResolvedValue({ id: PENDING });
      mocks.repo.findPendingByCards.mockResolvedValue([{ id: "old-card", cardTs: "2.2" }]);
      mocks.repo.claimPending.mockResolvedValue({ id: "old-card" });
      await slackService.handleMessage(reply, delivery);
      expect(mocks.repo.findPendingByCards).toHaveBeenCalledWith(TENANT, "C1", ["2.2"]);
      expect(mocks.repo.claimPending).toHaveBeenCalledWith(TENANT, "old-card", "cancelled");
      expect(mocks.client.updateMessage.mock.calls[0][0]).toMatchObject({ channel: "C1", ts: "2.2" });
      expect(mocks.client.postMessage.mock.calls[0][0].threadTs).toBe("1.1");
    });
  });

  it("tells an unmatched Slack user instead of acting for them", async () => {
    mocks.repo.findLink.mockResolvedValue(undefined);
    mocks.tenancy.listMembers.mockResolvedValue([{ id: "user-9", email: "someone@else.com", name: "X" }]);
    await slackService.handleMessage(message, delivery);
    expect(mocks.agent.runAgent).not.toHaveBeenCalled();
    expect(mocks.client.postMessage.mock.calls[0][0].text).toContain("couldn't match");
  });

  it("in a test deployment (SLACK_ALLOW_UNLINKED_USERS) lets an unmatched Slack user through, acting as nobody", async () => {
    vi.stubEnv("SLACK_ALLOW_UNLINKED_USERS", "true");
    mocks.repo.findLink.mockResolvedValue(undefined);
    mocks.tenancy.listMembers.mockResolvedValue([]);
    mocks.agent.runAgent.mockResolvedValue({ kind: "reply", text: "hi" });
    await slackService.handleMessage(message, delivery);
    expect(mocks.agent.runAgent).toHaveBeenCalledTimes(1);
    expect(mocks.agent.runAgent.mock.calls[0][1].senderPersonId).toBeNull();
    vi.unstubAllEnvs();
  });

  it("links a Slack user to the member with the same email, then runs the agent for them", async () => {
    mocks.repo.findLink.mockResolvedValue(undefined);
    mocks.tenancy.listMembers.mockResolvedValue([{ id: "user-1", email: "Boss@Tagr.com", name: "Boss" }]);
    mocks.agent.runAgent.mockResolvedValue({ kind: "reply", text: "hi" });
    await slackService.handleMessage(message, delivery);
    expect(mocks.repo.upsertLink).toHaveBeenCalledWith(TENANT, "U1", "user-1");
    expect(mocks.client.postMessage).toHaveBeenCalledWith({ channel: "C1", text: "hi", threadTs: "1.1" });
  });

  it("stores a proposal as pending and posts a card whose buttons carry only the workspace and its id", async () => {
    const payload = { kind: "complete", id: "x", subject: "Call João", done: true };
    mocks.agent.runAgent.mockResolvedValue({ kind: "propose", payload });
    mocks.repo.insertPending.mockResolvedValue({ id: PENDING });
    await slackService.handleMessage(message, delivery);
    expect(mocks.repo.insertPending).toHaveBeenCalledWith(TENANT, expect.objectContaining({ slackUserId: "U1", payload, channelId: "C1" }));
    const posted = mocks.client.postMessage.mock.calls[0][0];
    expect(JSON.stringify(posted.blocks)).toContain(`"value":"${TENANT}.${PENDING}"`);
    expect(mocks.repo.setCardTs).toHaveBeenCalledWith(TENANT, PENDING, "2.2");
  });
});

describe("handleInteraction", () => {
  const press = (action_id: string, value = `${TENANT}.${PENDING}`) => ({ type: "block_actions", user: { id: "U2" }, channel: { id: "C1" }, message: { ts: "2.2" }, actions: [{ action_id, value }] });
  const pending = (over = {}) => ({
    id: PENDING,
    status: "pending",
    slackUserId: "U1",
    expiresAt: new Date(Date.now() + 60_000),
    payload: { kind: "create", fields: { type: "call", subject: "Call João", dueDate: "2026-10-23T21:00:00.000Z", timezone: "America/Phoenix", assignedToPersonId: null }, labels: {} },
    ...over,
  });

  beforeEach(() => {
    mocks.repo.findPending.mockResolvedValue(pending());
    mocks.repo.claimPending.mockResolvedValue({ id: PENDING });
    mocks.activities.create.mockResolvedValue({ id: "act-1", subject: "Call João", assignedToPersonId: null });
  });

  it("creates from the STORED proposal, as the person who asked", async () => {
    await slackService.handleInteraction(press("slack_confirm"), delivery);
    expect(mocks.activities.create).toHaveBeenCalledTimes(1);
    const [tenantId, data, createdBy] = mocks.activities.create.mock.calls[0];
    expect(tenantId).toBe(TENANT);
    expect(data).toMatchObject({ type: "call", subject: "Call João" });
    expect(data.dueDate).toEqual(new Date("2026-10-23T21:00:00.000Z"));
    expect(createdBy).toBe("user-1");
    expect(mocks.client.updateMessage.mock.calls[0][0].text).toContain("Created");
  });

  it("does nothing when the card was already used (two presses, one write)", async () => {
    mocks.repo.claimPending.mockResolvedValue(null);
    await slackService.handleInteraction(press("slack_confirm"), delivery);
    expect(mocks.activities.create).not.toHaveBeenCalled();
  });

  it("refuses an expired or already-handled card", async () => {
    mocks.repo.findPending.mockResolvedValue(pending({ expiresAt: new Date(Date.now() - 1000) }));
    await slackService.handleInteraction(press("slack_confirm"), delivery);
    mocks.repo.findPending.mockResolvedValue(pending({ status: "done" }));
    await slackService.handleInteraction(press("slack_confirm"), delivery);
    expect(mocks.repo.claimPending).not.toHaveBeenCalled();
    expect(mocks.activities.create).not.toHaveBeenCalled();
  });

  it("cancel writes nothing", async () => {
    await slackService.handleInteraction(press("slack_cancel"), delivery);
    expect(mocks.repo.claimPending).toHaveBeenCalledWith(TENANT, PENDING, "cancelled");
    expect(mocks.activities.create).not.toHaveBeenCalled();
  });

  it("puts the card back when the write is refused, and says why", async () => {
    mocks.activities.create.mockRejectedValue(new UserFacingError("That person isn't on this workspace's team."));
    await slackService.handleInteraction(press("slack_confirm"), delivery);
    expect(mocks.repo.releasePending).toHaveBeenCalledWith(TENANT, PENDING);
    expect(mocks.client.postMessage.mock.calls[0][0].text).toContain("isn't on this workspace's team");
  });

  it("does not leak an unexpected error to Slack", async () => {
    mocks.activities.create.mockRejectedValue(new Error('insert into "activities" ... secret sql'));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await slackService.handleInteraction(press("slack_confirm"), delivery);
    expect(mocks.client.postMessage.mock.calls[0][0].text).not.toContain("sql");
  });

  it("refuses a press from someone who isn't a member of the workspace", async () => {
    mocks.repo.findLink.mockResolvedValue(undefined);
    mocks.tenancy.listMembers.mockResolvedValue([]);
    await slackService.handleInteraction(press("slack_confirm"), delivery);
    expect(mocks.repo.claimPending).not.toHaveBeenCalled();
    expect(mocks.activities.create).not.toHaveBeenCalled();
  });

  it("in a test deployment an unmatched presser can confirm, and the activity has no creator", async () => {
    vi.stubEnv("SLACK_ALLOW_UNLINKED_USERS", "true");
    mocks.repo.findLink.mockResolvedValue(undefined);
    mocks.tenancy.listMembers.mockResolvedValue([]);
    await slackService.handleInteraction(press("slack_confirm"), delivery);
    expect(mocks.activities.create.mock.calls[0][2]).toBeNull();
    vi.unstubAllEnvs();
  });

  it("ignores a button value that isn't an id", async () => {
    await slackService.handleInteraction(press("slack_confirm", "../../etc"), delivery);
    expect(mocks.repo.findPending).not.toHaveBeenCalled();
  });
});

describe("several CRM workspaces on one Slack team", () => {
  const TENANT_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const installations = [
    { tenantId: TENANT, commandChannelId: "C1" },
    { tenantId: TENANT_2, commandChannelId: "C2" },
  ];
  const memberOf = (...tenants: string[]) => {
    mocks.repo.findLink.mockImplementation(async (tenantId: string) => (tenants.includes(tenantId) ? { userId: `user-in-${tenantId.slice(0, 4)}` } : undefined));
    mocks.tenancy.listMembers.mockResolvedValue([]);
  };

  beforeEach(() => {
    mocks.installations.listForTeam.mockResolvedValue(installations);
    mocks.tenancy.getTenant.mockImplementation(async (id: string) => ({ id, slug: id === TENANT ? "tagr" : "grounded", name: id === TENANT ? "Tagr" : "Grounded", archivedAt: null }));
    mocks.agent.runAgent.mockResolvedValue({ kind: "propose", payload: { kind: "complete", id: "x", subject: "S", done: true } });
    mocks.repo.insertPending.mockResolvedValue({ id: PENDING });
  });

  it("a message in a workspace's own channel is handled in THAT workspace", async () => {
    memberOf(TENANT, TENANT_2);
    await slackService.handleMessage({ ...message, channel: "C2" }, delivery);
    expect(mocks.repo.insertPending).toHaveBeenCalledWith(TENANT_2, expect.anything());
    // The card's buttons name the workspace.
    expect(JSON.stringify(mocks.client.postMessage.mock.calls[0][0].blocks)).toContain(`"value":"${TENANT_2}.${PENDING}"`);
  });

  it("does not fall back to another workspace when the person isn't a member of the channel's", async () => {
    memberOf(TENANT_2); // a member of Grounded only
    mocks.tenancy.listMembers.mockResolvedValue([]);
    await slackService.handleMessage({ ...message, channel: "C1" }, delivery); // Tagr's channel
    expect(mocks.agent.runAgent).not.toHaveBeenCalled();
    expect(mocks.client.postMessage.mock.calls[0][0].text).toContain("member of Tagr");
  });

  it("an @mention elsewhere goes to the one workspace the person belongs to", async () => {
    memberOf(TENANT_2);
    await slackService.handleMessage({ ...message, type: "app_mention", channel: "C-random" }, delivery);
    expect(mocks.repo.insertPending).toHaveBeenCalledWith(TENANT_2, expect.anything());
  });

  it("an @mention elsewhere asks which workspace when the person belongs to several", async () => {
    memberOf(TENANT, TENANT_2);
    await slackService.handleMessage({ ...message, type: "app_mention", channel: "C-random" }, delivery);
    expect(mocks.agent.runAgent).not.toHaveBeenCalled();
    const said = mocks.client.postMessage.mock.calls[0][0].text;
    expect(said).toContain("<#C1> (Tagr)");
    expect(said).toContain("<#C2> (Grounded)");
  });

  it("a press is applied in the workspace the button names, if the Slack team is connected to it", async () => {
    memberOf(TENANT_2);
    mocks.repo.findPending.mockResolvedValue({ id: PENDING, status: "pending", slackUserId: "U1", expiresAt: new Date(Date.now() + 60_000), payload: { kind: "complete", id: "act", subject: "S", done: true } });
    mocks.repo.claimPending.mockResolvedValue({ id: PENDING });
    mocks.activities.setDone.mockResolvedValue({ id: "act", subject: "S" });
    const press = { type: "block_actions", user: { id: "U2" }, channel: { id: "C2" }, message: { ts: "2.2" }, actions: [{ action_id: "slack_confirm", value: `${TENANT_2}.${PENDING}` }] };
    await slackService.handleInteraction(press, delivery);
    expect(mocks.installations.find).toHaveBeenCalledWith("T1", "A1", TENANT_2);
    expect(mocks.repo.findPending).toHaveBeenCalledWith(TENANT_2, PENDING);
    expect(mocks.activities.setDone).toHaveBeenCalledWith(TENANT_2, "act", true);
  });

  it("ignores a press naming a workspace this Slack team isn't connected to", async () => {
    mocks.installations.find.mockResolvedValue(undefined);
    const press = { type: "block_actions", user: { id: "U2" }, channel: { id: "C2" }, message: { ts: "2.2" }, actions: [{ action_id: "slack_confirm", value: `${TENANT_2}.${PENDING}` }] };
    await slackService.handleInteraction(press, delivery);
    expect(mocks.repo.findPending).not.toHaveBeenCalled();
  });
});

describe("confirming contacts, companies and cards", () => {
  const BOARD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const CONTACT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const press = { type: "block_actions", user: { id: "U2" }, channel: { id: "C1" }, message: { ts: "2.2" }, actions: [{ action_id: "slack_confirm", value: `${TENANT}.${PENDING}` }] };
  const confirm = async (payload: object) => {
    mocks.repo.findPending.mockResolvedValue({ id: PENDING, status: "pending", slackUserId: "U1", expiresAt: new Date(Date.now() + 60_000), payload });
    mocks.repo.claimPending.mockResolvedValue({ id: PENDING });
    await slackService.handleInteraction(press, delivery);
    return mocks.client.updateMessage.mock.calls.at(-1)?.[0].text as string;
  };

  it("creates a contact through the contacts service", async () => {
    mocks.contacts.create.mockResolvedValue({ id: CONTACT, name: "Ana Costa" });
    const text = await confirm({ kind: "create_contact", fields: { name: "Ana Costa", email: "ana@acme.com", phone: null, organizationId: null }, labels: {} });
    expect(mocks.contacts.create).toHaveBeenCalledWith(TENANT, { name: "Ana Costa", email: "ana@acme.com", phone: null, organizationId: null });
    expect(text).toContain("Created contact Ana Costa");
  });

  it("edits a contact by id, in this workspace", async () => {
    mocks.contacts.update.mockResolvedValue({ id: CONTACT, name: "Ana Costa" });
    await confirm({ kind: "update_contact", id: CONTACT, was: "Ana", fields: { name: "Ana Costa", email: null, phone: "555", organizationId: null }, labels: {} });
    expect(mocks.contacts.update).toHaveBeenCalledWith(TENANT, CONTACT, { name: "Ana Costa", email: null, phone: "555", organizationId: null });
  });

  it("creates a company, with an empty website as the form sends it", async () => {
    mocks.organizations.create.mockResolvedValue({ id: "o1", name: "Acme" });
    await confirm({ kind: "create_organization", fields: { name: "Acme", website: null, notes: null } });
    expect(mocks.organizations.create).toHaveBeenCalledWith(TENANT, expect.objectContaining({ name: "Acme", website: "" }));
  });

  it("creates a lead and moves a card, naming where it went", async () => {
    mocks.pipeline.create.mockResolvedValue({ id: "c1", title: "Bakery Z" });
    const created = await confirm({ kind: "create_card", fields: { boardId: BOARD, title: "Bakery Z", stage: "sourced", contactId: null, organizationId: null, notes: null }, labels: { board: "Leads", stage: "Sourced", isLead: true } });
    expect(mocks.pipeline.create).toHaveBeenCalledWith(TENANT, expect.objectContaining({ boardId: BOARD, title: "Bakery Z", stage: "sourced" }));
    expect(created).toContain("Created lead Bakery Z");

    mocks.pipeline.update.mockResolvedValue({ id: "c1", title: "Bakery Z" });
    const moved = await confirm({ kind: "update_card", id: "c1", was: "Bakery Z", fields: { boardId: BOARD, title: "Bakery Z", stage: "in_discussion", contactId: null, organizationId: null, notes: null }, labels: { board: "Leads", stage: "In Discussion", isLead: true } });
    expect(mocks.pipeline.update).toHaveBeenCalledWith(TENANT, "c1", expect.objectContaining({ stage: "in_discussion" }));
    expect(moved).toContain("Updated lead Bakery Z · In Discussion");
  });

  it("puts the card back when a service refuses, and says why", async () => {
    mocks.contacts.create.mockRejectedValue(new UserFacingError("Nope."));
    mocks.client.postMessage.mockResolvedValue({ ts: "9.9" });
    await confirm({ kind: "create_contact", fields: { name: "Ana", email: null, phone: null, organizationId: null }, labels: {} });
    expect(mocks.repo.releasePending).toHaveBeenCalledWith(TENANT, PENDING);
  });
});
