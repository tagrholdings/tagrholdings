import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  installations: { findForTenant: vi.fn(), listForApp: vi.fn(), claimSend: vi.fn() },
  repo: { findLinks: vi.fn(), findLink: vi.fn(), upsertLink: vi.fn() },
  client: { lookupByEmail: vi.fn(), postDm: vi.fn(), postMessage: vi.fn() },
  tenancy: { listMembers: vi.fn(), getTenant: vi.fn(), isMember: vi.fn() },
  leads: { listNewSince: vi.fn(), listForTenant: vi.fn(), countNew: vi.fn() },
  activities: { listForTenant: vi.fn() },
  team: { personForUser: vi.fn() },
  pipeline: { listAllForTenant: vi.fn(), listBoards: vi.fn() },
  engine: { getSpendTotals: vi.fn() },
  traction: { getSummary: vi.fn(), getL10Schedule: vi.fn() },
  gemini: { generateGeminiJson: vi.fn() },
}));

vi.mock("./slack-installations.repository", () => ({ slackInstallationsRepository: mocks.installations }));
vi.mock("./slack.repository", () => ({ slackRepository: mocks.repo }));
vi.mock("./slack.client", () => ({ slackClient: mocks.client }));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: mocks.tenancy }));
vi.mock("@/modules/leads/leads.service", () => ({ leadsService: mocks.leads }));
vi.mock("@/modules/activities/activities.service", () => ({ activitiesService: mocks.activities }));
vi.mock("@/modules/team/team.service", () => ({ teamService: mocks.team }));
vi.mock("@/modules/pipeline/pipeline.service", () => ({ pipelineService: mocks.pipeline }));
vi.mock("@/modules/lead-engine/lead-engine.service", () => ({ leadEngineService: mocks.engine }));
vi.mock("@/modules/traction/traction.service", () => ({ tractionService: mocks.traction }));

vi.mock("@/lib/gemini", () => ({ generateGeminiJson: mocks.gemini.generateGeminiJson }));

import { slackNotifyService } from "./slack-notify.service";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const link = (over = {}) => ({ slackUserId: "U1", userId: "user-1", timeZone: "America/Phoenix", remindDm: true, l10Dm: true, digestDm: false, weeklyDm: true, ...over });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A1");
  mocks.installations.findForTenant.mockResolvedValue({ tenantId: TENANT, commandChannelId: "C1" });
  mocks.installations.listForApp.mockResolvedValue([{ tenantId: TENANT, commandChannelId: "C1" }]);
  mocks.installations.claimSend.mockResolvedValue(true);
  mocks.repo.findLinks.mockResolvedValue([]);
  mocks.client.postDm.mockResolvedValue({ ts: "1.1", channel: "D1" });
  mocks.client.postMessage.mockResolvedValue({ ts: "1.1" });
  mocks.tenancy.getTenant.mockResolvedValue({ id: TENANT, slug: "tagr", name: "Tagr", archivedAt: null });
  mocks.tenancy.isMember.mockResolvedValue(true);
  mocks.leads.listNewSince.mockResolvedValue([]);
  mocks.leads.listForTenant.mockResolvedValue([]);
  mocks.leads.countNew.mockResolvedValue(0);
  mocks.activities.listForTenant.mockResolvedValue([]);
  mocks.pipeline.listAllForTenant.mockResolvedValue([]);
  mocks.pipeline.listBoards.mockResolvedValue([]);
  mocks.engine.getSpendTotals.mockResolvedValue({ last7DaysUsd: 1.5 });
  mocks.traction.getL10Schedule.mockResolvedValue(null);
  mocks.traction.getSummary.mockResolvedValue({ scorecard: { onGoal: 3, offGoal: 1, notEntered: 0, total: 4 }, rocks: { quarter: "2026-Q4", total: 5, complete: 2, onTrack: 2, offTrack: 1 }, openIssues: 6, todos: { done: 4, total: 9 } });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("resolveRecipients", () => {
  it("finds nobody when Slack isn't configured or the workspace isn't connected", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    expect((await slackNotifyService.resolveRecipients(TENANT, ["user-1"])).size).toBe(0);
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    mocks.installations.findForTenant.mockResolvedValue(undefined);
    expect((await slackNotifyService.resolveRecipients(TENANT, ["user-1"])).size).toBe(0);
    expect(mocks.client.lookupByEmail).not.toHaveBeenCalled();
  });

  it("uses a stored link without asking Slack", async () => {
    mocks.repo.findLinks.mockResolvedValue([link()]);
    const found = await slackNotifyService.resolveRecipients(TENANT, ["user-1"]);
    expect(found.get("user-1")?.slackUserId).toBe("U1");
    expect(mocks.client.lookupByEmail).not.toHaveBeenCalled();
  });

  it("finds a member by e-mail, links them, and remembers their zone", async () => {
    mocks.tenancy.listMembers.mockResolvedValue([{ id: "user-2", email: "Ana@Tagr.com", name: "Ana", role: "member" }]);
    mocks.client.lookupByEmail.mockResolvedValue({ id: "U2", name: "Ana", timeZone: "America/New_York" });
    mocks.repo.findLink.mockResolvedValue(link({ slackUserId: "U2", userId: "user-2" }));
    const found = await slackNotifyService.resolveRecipients(TENANT, ["user-2"]);
    expect(mocks.client.lookupByEmail).toHaveBeenCalledWith("ana@tagr.com");
    expect(mocks.repo.upsertLink).toHaveBeenCalledWith(TENANT, "U2", "user-2", "America/New_York");
    expect(found.get("user-2")?.slackUserId).toBe("U2");
  });

  it("skips a member who isn't on Slack, and doesn't ask again for a while", async () => {
    mocks.tenancy.listMembers.mockResolvedValue([{ id: "user-9", email: "ghost@tagr.com", name: "Ghost", role: "member" }]);
    mocks.client.lookupByEmail.mockResolvedValue(null);
    expect((await slackNotifyService.resolveRecipients(TENANT, ["user-9"])).size).toBe(0);
    await slackNotifyService.resolveRecipients(TENANT, ["user-9"]);
    expect(mocks.client.lookupByEmail).toHaveBeenCalledTimes(1);
  });

  it("never throws when Slack fails", async () => {
    mocks.repo.findLinks.mockRejectedValue(new Error("db down"));
    expect((await slackNotifyService.resolveRecipients(TENANT, ["user-1"])).size).toBe(0);
  });
});

describe("DMs", () => {
  it("a reminder reaches only the people who didn't turn Slack reminders off, with Done and Snooze buttons", async () => {
    mocks.repo.findLinks.mockResolvedValue([link(), link({ slackUserId: "U2", userId: "user-2", remindDm: false })]);
    const sent = await slackNotifyService.dmReminder(TENANT, "tagr", { id: "act-1", type: "call", subject: "Call João" }, ["user-1", "user-2"]);
    expect(sent).toBe(1);
    expect(mocks.client.postDm).toHaveBeenCalledTimes(1);
    expect(mocks.client.postDm.mock.calls[0][0]).toBe("U1");
    const buttons = JSON.stringify(mocks.client.postDm.mock.calls[0][1].blocks);
    expect(buttons).toContain(`"value":"${TENANT}.act-1"`);
    expect(buttons).toContain("slack_done");
    expect(buttons).toContain("slack_snooze");
  });

  it("a failed DM is counted out and doesn't stop the others", async () => {
    mocks.repo.findLinks.mockResolvedValue([link(), link({ slackUserId: "U2", userId: "user-2" })]);
    mocks.client.postDm.mockRejectedValueOnce(new Error("cannot_dm_bot")).mockResolvedValueOnce({ ts: "1", channel: "D" });
    expect(await slackNotifyService.dmReminder(TENANT, "tagr", { id: "a", type: "task", subject: "S" }, ["user-1", "user-2"])).toBe(1);
  });

  it("an assignment DM goes to the assignee unless they turned reminders off", async () => {
    mocks.repo.findLinks.mockResolvedValue([link()]);
    const activity = { id: "a1", type: "task", subject: "Send the LOI", dueDate: null };
    expect(await slackNotifyService.dmAssigned(TENANT, "tagr", activity, "user-1", "Boss")).toBe(true);
    expect(mocks.client.postDm.mock.calls[0][1].text).toContain("Send the LOI");
    mocks.repo.findLinks.mockResolvedValue([link({ remindDm: false })]);
    expect(await slackNotifyService.dmAssigned(TENANT, "tagr", activity, "user-1", "Boss")).toBe(false);
  });

  it("the L10 reminder goes one DM per teammate who kept it on", async () => {
    mocks.repo.findLinks.mockResolvedValue([link(), link({ slackUserId: "U2", userId: "user-2", l10Dm: false })]);
    const sent = await slackNotifyService.dmL10(
      { tenantId: TENANT, slug: "tagr", workspaceName: "Tagr", topIssues: ["Hiring"], offGoal: [], offTrackRocks: [], openTodos: 2, people: [{ userId: "user-1" }, { userId: "user-2" }, { userId: null }] },
      "Tuesday, Oct 27 · 8:00 AM"
    );
    expect(sent).toBe(1);
    expect(mocks.client.postDm.mock.calls[0][1].text).toContain("L10");
  });
});

describe("sweep: new leads", () => {
  const lead = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    sourceType: "broker_listings",
    sourceUrl: "https://broker.example/listing/1",
    businessName: `Biz ${id}`,
    extractedFields: { askingPrice: "$2M", estimatedRevenue: "$1.2M", location: { city: "Mesa", state: "AZ" }, summary: "A laundromat." },
    status: "new",
    createdAt: new Date(),
    fit: { status: "match", checks: [] },
    ...over,
  });

  it("posts a card with Add / Dismiss buttons in the workspace's command channel", async () => {
    mocks.leads.listNewSince.mockResolvedValue([lead("l1")]);
    expect(await slackNotifyService.sweep()).toEqual({ leads: 1, digests: 0, weekly: 0 });
    const [{ channel, blocks }] = mocks.client.postMessage.mock.calls[0];
    expect(channel).toBe("C1");
    const text = JSON.stringify(blocks);
    expect(text).toContain("Biz l1");
    expect(text).toContain("$2M");
    expect(text).toContain("Mesa, AZ");
    expect(text).toContain(`"value":"${TENANT}.l1"`);
    expect(text).toContain("slack_lead_promote");
    expect(text).toContain("slack_lead_dismiss");
  });

  it("announces a lead once: the claim is taken before posting, and a taken claim is skipped", async () => {
    mocks.leads.listNewSince.mockResolvedValue([lead("l1"), lead("l2")]);
    mocks.installations.claimSend.mockImplementation(async (key: string) => key !== "lead:l1");
    expect((await slackNotifyService.sweep()).leads).toBe(1);
    expect(mocks.client.postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.client.postMessage.mock.calls[0][0].blocks)).toContain("Biz l2");
  });

  it("shows the best five and summarises the rest", async () => {
    const fits = ["miss", "match", "partial", "match", "unknown", "match", "miss"];
    mocks.leads.listNewSince.mockResolvedValue(fits.map((status, i) => lead(`l${i}`, { fit: { status, checks: [] } })));
    const result = await slackNotifyService.sweep();
    expect(result.leads).toBe(6); // five cards + the "and 2 more" line
    const posted = mocks.client.postMessage.mock.calls.map(([m]) => JSON.stringify(m.blocks));
    expect(posted.slice(0, 3).every((p) => p.includes("Good fit"))).toBe(true);
    expect(posted.join("")).not.toContain("Poor fit\"}");
    expect(mocks.client.postMessage.mock.calls[5][0].text).toBe("…and 2 more new leads to review.");
  });

  it("only looks at the last day, skips a workspace with no command channel, and does nothing when Slack is off", async () => {
    mocks.leads.listNewSince.mockResolvedValue([]);
    await slackNotifyService.sweep(new Date("2026-10-22T12:00:00Z"));
    expect(mocks.leads.listNewSince.mock.calls[0][1]).toEqual(new Date("2026-10-21T12:00:00Z"));

    mocks.leads.listNewSince.mockClear();
    mocks.installations.listForApp.mockResolvedValue([{ tenantId: TENANT, commandChannelId: null }]);
    await slackNotifyService.sweep();
    expect(mocks.leads.listNewSince).not.toHaveBeenCalled();

    vi.stubEnv("SLACK_BOT_TOKEN", "");
    expect(await slackNotifyService.sweep()).toEqual({ leads: 0, digests: 0, weekly: 0 });
  });

  it("an archived workspace is skipped, and one workspace failing doesn't stop the sweep", async () => {
    mocks.installations.listForApp.mockResolvedValue([
      { tenantId: "t-archived", commandChannelId: "C9" },
      { tenantId: "t-broken", commandChannelId: "C8" },
      { tenantId: TENANT, commandChannelId: "C1" },
    ]);
    mocks.tenancy.getTenant.mockImplementation(async (id: string) => ({ id, slug: id, name: id, archivedAt: id === "t-archived" ? new Date() : null }));
    mocks.leads.listNewSince.mockImplementation(async (id: string) => {
      if (id === "t-broken") throw new Error("boom");
      return [lead("l1")];
    });
    expect((await slackNotifyService.sweep()).leads).toBe(1);
  });
});

describe("sweep: morning digest", () => {
  const phoenix8 = new Date("2026-10-22T15:30:00Z"); // 08:30 Thursday in Phoenix
  const due = (subject: string, iso: string, tz: string | null = null, over = {}) => ({ id: subject, subject, done: false, assignedToPersonId: "p1", dueDate: new Date(iso), timezone: tz, ...over });

  beforeEach(() => {
    mocks.repo.findLinks.mockResolvedValue([link({ digestDm: true })]);
    mocks.team.personForUser.mockResolvedValue({ id: "p1" });
    mocks.activities.listForTenant.mockResolvedValue([
      due("Call João", "2026-10-22T21:00:00Z", "America/Phoenix"), // today 2:00 PM
      due("Send LOI", "2026-10-22T07:00:00Z"), // today, date only
      due("Old thing", "2026-10-20T07:00:00Z"), // overdue
      due("Tomorrow", "2026-10-23T07:00:00Z"),
      due("Someone else's", "2026-10-22T07:00:00Z", null, { assignedToPersonId: "p2" }),
      due("Done", "2026-10-22T07:00:00Z", null, { done: true }),
    ]);
  });

  it("DMs a person who asked for it, at 8 their time: today's tasks, then the overdue ones", async () => {
    expect((await slackNotifyService.sweep(phoenix8)).digests).toBe(1);
    const [slackUser, message] = mocks.client.postDm.mock.calls[0];
    expect(slackUser).toBe("U1");
    expect(message.text).toBe("Good morning — 2 due today, 1 overdue");
    const text = JSON.stringify(message.blocks);
    expect(text).toContain("Call João");
    expect(text).toContain("2:00 PM");
    expect(text).toContain("Old thing");
    expect(text).not.toContain("Tomorrow");
    expect(text).not.toContain("Someone else");
    expect(mocks.installations.claimSend).toHaveBeenCalledWith("digest:" + TENANT + ":U1:2026-10-22");
  });

  it("is off unless asked for, only in the 8 o'clock hour, once a day, and never when nothing is due", async () => {
    mocks.repo.findLinks.mockResolvedValue([link({ digestDm: false })]);
    expect((await slackNotifyService.sweep(phoenix8)).digests).toBe(0);

    mocks.repo.findLinks.mockResolvedValue([link({ digestDm: true })]);
    expect((await slackNotifyService.sweep(new Date("2026-10-22T16:30:00Z"))).digests).toBe(0); // 09:30
    expect((await slackNotifyService.sweep(new Date("2026-10-22T14:30:00Z"))).digests).toBe(0); // 07:30

    mocks.installations.claimSend.mockResolvedValue(false);
    expect((await slackNotifyService.sweep(phoenix8)).digests).toBe(0); // already sent today
    mocks.installations.claimSend.mockResolvedValue(true);

    mocks.activities.listForTenant.mockResolvedValue([]);
    expect((await slackNotifyService.sweep(phoenix8)).digests).toBe(0);
    expect(mocks.client.postDm).not.toHaveBeenCalled();
  });

  it("uses each person's own zone: the same sweep is 8:30 for one and 11:30 for another", async () => {
    mocks.repo.findLinks.mockResolvedValue([link({ digestDm: true }), link({ slackUserId: "U2", userId: "user-2", digestDm: true, timeZone: "America/New_York" })]);
    expect((await slackNotifyService.sweep(phoenix8)).digests).toBe(1);
    expect(mocks.client.postDm.mock.calls[0][0]).toBe("U1");
  });
});

// The admins' pipeline report is paused (PIPELINE_WEEKLY_REPORT_PAUSED in slack-notify.service.ts). Switch the flag back and
// un-skip this to bring it back.
describe.skip("sweep: weekly report (paused)", () => {
  const monday = new Date("2026-10-26T15:30:00Z"); // 08:30 Monday in Phoenix
  const admins = () => {
    mocks.tenancy.listMembers.mockResolvedValue([
      { id: "user-1", email: "boss@tagr.com", name: "Boss", role: "admin" },
      { id: "user-2", email: "ana@tagr.com", name: "Ana", role: "member" },
    ]);
    mocks.repo.findLinks.mockResolvedValue([link(), link({ slackUserId: "U2", userId: "user-2" })]);
  };

  it("DMs the report to the admins only, once, with the week's numbers", async () => {
    admins();
    mocks.leads.countNew.mockResolvedValue(4);
    mocks.leads.listForTenant.mockResolvedValue([
      { sourceType: "broker_listings", status: "processed", createdAt: new Date("2026-10-24T12:00:00Z") },
      { sourceType: "broker_listings", status: "dismissed", createdAt: new Date("2026-10-23T12:00:00Z") },
      { sourceType: "email_digest", status: "new", createdAt: new Date("2026-10-01T12:00:00Z") },
    ]);
    expect((await slackNotifyService.sweep(monday)).weekly).toBe(1);
    expect(mocks.client.postDm).toHaveBeenCalledTimes(1);
    expect(mocks.client.postDm.mock.calls[0][0]).toBe("U1"); // the admin, not Ana
    const text = JSON.stringify(mocks.client.postDm.mock.calls[0][1].blocks);
    expect(text).toContain("Weekly report");
    expect(text).toContain("2 arrived this week (1 added to the pipeline, 1 dismissed)");
    expect(text).toContain("*4* waiting for review");
    expect(text).toContain("$1.50");
    expect(text).toContain("3 on goal");
    expect(text).toContain("2/5 complete");
    expect(mocks.installations.claimSend).toHaveBeenCalledWith("weekly:" + TENANT + ":2026-10-26");
  });

  it("only on Monday, from 8:00 in the workspace's L10 zone", async () => {
    admins();
    expect((await slackNotifyService.sweep(new Date("2026-10-27T15:30:00Z"))).weekly).toBe(0); // Tuesday
    expect((await slackNotifyService.sweep(new Date("2026-10-26T14:30:00Z"))).weekly).toBe(0); // Monday 07:30
    mocks.traction.getL10Schedule.mockResolvedValue({ timezone: "America/New_York" });
    expect((await slackNotifyService.sweep(new Date("2026-10-26T11:30:00Z"))).weekly).toBe(0); // Monday 07:30 in New York
    expect((await slackNotifyService.sweep(new Date("2026-10-26T12:30:00Z"))).weekly).toBe(1); // 08:30 in New York
  });

  it("doesn't spend the week's claim when no admin can be reached, and skips admins who turned it off", async () => {
    admins();
    mocks.repo.findLinks.mockResolvedValue([link({ weeklyDm: false })]);
    expect((await slackNotifyService.sweep(monday)).weekly).toBe(0);
    expect(mocks.installations.claimSend).not.toHaveBeenCalledWith(expect.stringContaining("weekly:"));
  });

  it("is not sent twice", async () => {
    admins();
    mocks.installations.claimSend.mockImplementation(async (key: string) => !key.startsWith("weekly:"));
    expect((await slackNotifyService.sweep(monday)).weekly).toBe(0);
  });
});

describe("sweep: personal week plan and review", () => {
  const monday9 = new Date("2026-11-16T16:30:00Z"); // 09:30 Monday in Phoenix
  const friday3 = new Date("2026-11-20T22:30:00Z"); // 15:30 Friday in Phoenix
  const act = (subject: string, iso: string | null, over = {}) => ({ id: subject, type: "task", subject, done: false, assignedToPersonId: "p1", dueDate: iso ? new Date(iso) : null, timezone: null, updatedAt: new Date("2026-11-01T00:00:00Z"), contactName: null, organizationName: null, pipelineItemTitle: null, ...over });

  beforeEach(() => {
    mocks.repo.findLinks.mockResolvedValue([link()]);
    mocks.team.personForUser.mockResolvedValue({ id: "p1" });
    mocks.activities.listForTenant.mockResolvedValue([
      act("Call João", "2026-11-16T21:00:00Z", { timezone: "America/Phoenix" }), // Monday 2:00 PM
      act("Send LOI", "2026-11-18T07:00:00Z"), // Wednesday, date only
      act("Last week's leftover", "2026-11-12T07:00:00Z"),
      act("Next week", "2026-11-23T07:00:00Z"),
      act("Someone else's", "2026-11-17T07:00:00Z", { assignedToPersonId: "p2" }),
      act("Already done", "2026-11-17T07:00:00Z", { done: true, updatedAt: new Date("2026-11-17T20:00:00Z") }),
      act("Closed the Mesa deal", "2026-11-18T07:00:00Z", { done: true, completedAt: new Date("2026-11-18T20:00:00Z"), updatedAt: new Date("2026-11-18T20:00:00Z") }),
      act("Done long ago", "2026-11-05T07:00:00Z", { done: true, completedAt: new Date("2026-11-05T20:00:00Z"), updatedAt: new Date("2026-11-19T20:00:00Z") }), // edited this week, but finished long ago
      act("Still to do Friday", "2026-11-20T07:00:00Z"),
    ]);
  });

  it("Monday 9:00 their time: this week's open tasks by day, nothing from the week before", async () => {
    expect((await slackNotifyService.sweep(monday9)).weekly).toBe(1);
    const [slackUser, message] = mocks.client.postDm.mock.calls[0];
    expect(slackUser).toBe("U1");
    const text = JSON.stringify(message.blocks);
    expect(message.text).toBe("Your week — 3 tasks scheduled");
    expect(text).toContain("Mon, Nov 16");
    expect(text).toContain("Call João");
    expect(text).toContain("2:00 PM");
    expect(text).toContain("Wed, Nov 18");
    expect(text).toContain("Send LOI");
    expect(text).toContain("Still to do Friday");
    expect(text).not.toContain("leftover");
    expect(text).not.toContain("Next week");
    expect(text).not.toContain("Someone else");
    expect(text).not.toContain("Already done");
    expect(mocks.installations.claimSend).toHaveBeenCalledWith("weekplan:" + TENANT + ":U1:2026-11-16");
    expect(mocks.gemini.generateGeminiJson).not.toHaveBeenCalled();
  });

  it("Friday 15:00 their time: the AI recap of what was done this week, and what is still open", async () => {
    mocks.gemini.generateGeminiJson.mockResolvedValue({ status: "ok", parsed: { summary: "You closed the Mesa deal." }, model: "m", inputTokens: 1, outputTokens: 1 });
    expect((await slackNotifyService.sweep(friday3)).weekly).toBe(1);
    const [, message] = mocks.client.postDm.mock.calls[0];
    const text = JSON.stringify(message.blocks);
    expect(message.text).toBe("Your week in review — 2 done, 3 still open");
    expect(text).toContain("You closed the Mesa deal.");
    expect(text).toContain("Still to do Friday");
    expect(text).not.toContain("Done long ago");
    expect(text).not.toContain("leftover");
    const prompt = mocks.gemini.generateGeminiJson.mock.calls[0][0].user as string;
    expect(prompt).toContain("Closed the Mesa deal");
    expect(prompt).not.toContain("Done long ago");
    expect(mocks.installations.claimSend).toHaveBeenCalledWith("weekwrap:" + TENANT + ":U1:2026-11-20");
  });

  it("Friday still goes out, as a plain list, when the AI doesn't answer", async () => {
    mocks.gemini.generateGeminiJson.mockResolvedValue({ status: "failed" });
    expect((await slackNotifyService.sweep(friday3)).weekly).toBe(1);
    const text = JSON.stringify(mocks.client.postDm.mock.calls[0][1].blocks);
    expect(text).toContain("Closed the Mesa deal");
    expect(text).toContain("Already done");
  });

  it("only at the right hour on the right day, in each person's own zone, once, and never to someone who turned it off", async () => {
    expect((await slackNotifyService.sweep(new Date("2026-11-16T15:30:00Z"))).weekly).toBe(0); // Monday 08:30
    expect((await slackNotifyService.sweep(new Date("2026-11-17T16:30:00Z"))).weekly).toBe(0); // Tuesday 09:30
    expect((await slackNotifyService.sweep(new Date("2026-11-20T16:30:00Z"))).weekly).toBe(0); // Friday 09:30 (the review is at 15:00)
    mocks.repo.findLinks.mockResolvedValue([link(), link({ slackUserId: "U2", userId: "user-2", timeZone: "America/New_York" })]);
    mocks.team.personForUser.mockImplementation(async (_t: string, userId: string) => ({ id: userId === "user-1" ? "p1" : "p2" }));
    expect((await slackNotifyService.sweep(monday9)).weekly).toBe(1); // 09:30 in Phoenix is 11:30 in New York
    expect(mocks.client.postDm.mock.calls[0][0]).toBe("U1");

    mocks.client.postDm.mockClear();
    mocks.repo.findLinks.mockResolvedValue([link({ weeklyDm: false })]);
    expect((await slackNotifyService.sweep(monday9)).weekly).toBe(0);
    mocks.repo.findLinks.mockResolvedValue([link()]);
    mocks.installations.claimSend.mockResolvedValue(false);
    expect((await slackNotifyService.sweep(monday9)).weekly).toBe(0); // already sent
    expect(mocks.client.postDm).not.toHaveBeenCalled();
  });

  it("sends nothing when there is nothing to say", async () => {
    mocks.activities.listForTenant.mockResolvedValue([]);
    expect((await slackNotifyService.sweep(monday9)).weekly).toBe(0);
    expect((await slackNotifyService.sweep(friday3)).weekly).toBe(0);
  });
});
