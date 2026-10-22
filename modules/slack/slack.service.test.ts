import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserFacingError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  installations: { find: vi.fn(), claimMessage: vi.fn(), deleteClaimsOlderThan: vi.fn() },
  repo: { findLink: vi.fn(), upsertLink: vi.fn(), deleteLink: vi.fn(), insertPending: vi.fn(), setCardTs: vi.fn(), findPending: vi.fn(), claimPending: vi.fn(), releasePending: vi.fn(), deleteExpired: vi.fn() },
  client: { postMessage: vi.fn(), updateMessage: vi.fn(), getUser: vi.fn(), downloadAudio: vi.fn() },
  tenancy: { getTenant: vi.fn(), isMember: vi.fn(), listMembers: vi.fn() },
  team: { personForUser: vi.fn() },
  activities: { create: vi.fn(), update: vi.fn(), setDone: vi.fn() },
  notifications: { notifyAssigned: vi.fn() },
  rateLimit: { isLimited: vi.fn() },
  agent: { runAgent: vi.fn() },
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
vi.mock("@/modules/contacts/contacts.service", () => ({ contactsService: {} }));
vi.mock("@/modules/organizations/organizations.service", () => ({ organizationsService: {} }));
vi.mock("@/modules/pipeline/pipeline.service", () => ({ pipelineService: {} }));
vi.mock("@/lib/revalidate", () => ({ revalidateWorkspace: vi.fn() }));
vi.mock("@/lib/gemini", () => ({ generateGemini: vi.fn(), GeminiUnavailable: class extends Error {} }));

import { slackService } from "./slack.service";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PENDING = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const delivery = { teamId: "T1", apiAppId: "A1" };
const message = { type: "message" as const, user: "U1", text: "call João tomorrow", ts: "1.1", channel: "C1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.installations.find.mockResolvedValue({ tenantId: TENANT, commandChannelId: "C1" });
  mocks.installations.claimMessage.mockResolvedValue(true);
  mocks.tenancy.getTenant.mockResolvedValue({ id: TENANT, slug: "tagr", name: "Tagr", archivedAt: null });
  mocks.tenancy.isMember.mockResolvedValue(true);
  mocks.rateLimit.isLimited.mockResolvedValue(false);
  mocks.client.getUser.mockResolvedValue({ email: "boss@tagr.com", name: "Boss", timeZone: "America/Phoenix" });
  mocks.client.postMessage.mockResolvedValue({ ts: "2.2" });
  mocks.client.updateMessage.mockResolvedValue(undefined);
  mocks.repo.findLink.mockResolvedValue({ userId: "user-1" });
  mocks.team.personForUser.mockResolvedValue({ id: "person-1" });
});

describe("handleMessage", () => {
  it("ignores a team with no connected workspace", async () => {
    mocks.installations.find.mockResolvedValue(undefined);
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

  it("ignores bots, edits and thread replies, and processes a message only once", async () => {
    await slackService.handleMessage({ ...message, bot_id: "B1" }, delivery);
    await slackService.handleMessage({ ...message, subtype: "message_changed" }, delivery);
    await slackService.handleMessage({ ...message, thread_ts: "0.5" }, delivery);
    mocks.installations.claimMessage.mockResolvedValue(false);
    await slackService.handleMessage(message, delivery);
    expect(mocks.agent.runAgent).not.toHaveBeenCalled();
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

  it("stores a proposal as pending and posts a card whose buttons carry only its id", async () => {
    const payload = { kind: "complete", id: "x", subject: "Call João", done: true };
    mocks.agent.runAgent.mockResolvedValue({ kind: "propose", payload });
    mocks.repo.insertPending.mockResolvedValue({ id: PENDING });
    await slackService.handleMessage(message, delivery);
    expect(mocks.repo.insertPending).toHaveBeenCalledWith(TENANT, expect.objectContaining({ slackUserId: "U1", payload, channelId: "C1" }));
    const posted = mocks.client.postMessage.mock.calls[0][0];
    expect(JSON.stringify(posted.blocks)).toContain(`"value":"${PENDING}"`);
    expect(mocks.repo.setCardTs).toHaveBeenCalledWith(TENANT, PENDING, "2.2");
  });
});

describe("handleInteraction", () => {
  const press = (action_id: string, value = PENDING) => ({ type: "block_actions", user: { id: "U2" }, channel: { id: "C1" }, message: { ts: "2.2" }, actions: [{ action_id, value }] });
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
