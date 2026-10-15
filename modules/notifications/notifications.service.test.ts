import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./notifications.repository", () => ({
  notificationsRepository: { upsert: vi.fn(), deleteOwnByEndpoint: vi.fn(), deleteByIds: vi.fn(), findByUserIds: vi.fn() },
}));
vi.mock("@/lib/web-push", () => ({ isPushConfigured: vi.fn(), sendPush: vi.fn() }));
vi.mock("@/modules/activities/activities.service", () => ({ activitiesService: { claimDueReminders: vi.fn() } }));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { listTenants: vi.fn(), listMembers: vi.fn() } }));
vi.mock("@/modules/team/team.service", () => ({ teamService: { listPeople: vi.fn() } }));
vi.mock("@/modules/traction/traction.service", () => ({ tractionService: { claimDueL10Reminders: vi.fn() } }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { notificationsService } from "./notifications.service";
import { notificationsRepository } from "./notifications.repository";
import { isPushConfigured, sendPush } from "@/lib/web-push";
import { activitiesService } from "@/modules/activities/activities.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { teamService } from "@/modules/team/team.service";
import { tractionService } from "@/modules/traction/traction.service";
import { sendEmail } from "@/lib/email/send";

const NOW = new Date("2026-09-28T15:00:00Z");
const sub = (id: string) => ({ id, endpoint: `https://fcm.googleapis.com/${id}`, p256dh: "k", auth: "a" });
const reminder = (over: Partial<{ id: string; assignedToPersonId: string | null }> = {}) => ({
  id: "act-1",
  type: "call",
  subject: "Call the seller",
  dueDate: NOW,
  assignedToPersonId: null,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isPushConfigured).mockReturnValue(true);
  vi.mocked(sendPush).mockResolvedValue("sent");
  vi.mocked(tenancyService.listTenants).mockResolvedValue([{ id: "t1", slug: "acme", name: "Acme" }]);
  vi.mocked(tenancyService.listMembers).mockResolvedValue([
    { id: "u1", name: "Tanner", email: "t@x.com", role: "admin" },
    { id: "u2", name: "Matheus", email: "m@x.com", role: "member" },
  ]);
  vi.mocked(notificationsRepository.findByUserIds).mockResolvedValue([sub("s1")]);
  // Tasks are assigned to team people: p2 is Matheus's login (u2); p-tech has no login.
  vi.mocked(teamService.listPeople).mockResolvedValue([
    { id: "p1", name: "Tanner", email: "t@x.com", title: null, userId: "u1", archivedAt: null },
    { id: "p2", name: "Matheus", email: "m@x.com", title: null, userId: "u2", archivedAt: null },
    { id: "p-tech", name: "Rex", email: null, title: null, userId: null, archivedAt: null },
  ]);
});

describe("subscribe", () => {
  const input = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } };

  it("stores the subscription for the signed-in user", async () => {
    await notificationsService.subscribe("u1", input);
    expect(notificationsRepository.upsert).toHaveBeenCalledWith("u1", input);
  });

  it("refuses an endpoint that isn't a known push service (the server POSTs to it)", async () => {
    await expect(notificationsService.subscribe("u1", { ...input, endpoint: "https://169.254.169.254/latest" })).rejects.toThrow("isn't supported");
    expect(notificationsRepository.upsert).not.toHaveBeenCalled();
  });
});

describe("sendDueTaskReminders", () => {
  it("does nothing when no reminder is due", async () => {
    vi.mocked(activitiesService.claimDueReminders).mockResolvedValue([]);
    expect(await notificationsService.sendDueTaskReminders(NOW)).toEqual({ reminders: 0, delivered: 0 });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("an assigned task goes only to its assignee, with a link to the activity", async () => {
    vi.mocked(activitiesService.claimDueReminders).mockResolvedValue([reminder({ assignedToPersonId: "p2" })] as never);
    const result = await notificationsService.sendDueTaskReminders(NOW);
    expect(notificationsRepository.findByUserIds).toHaveBeenCalledWith(["u2"]);
    expect(sendPush).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://fcm.googleapis.com/s1" }),
      expect.objectContaining({ title: "Call the seller", body: "Call due now", url: "/w/acme/activities?activity=act-1", tag: "activity-act-1" })
    );
    expect(result).toEqual({ reminders: 1, delivered: 1 });
  });

  it("a task assigned to someone without a login is pushed to nobody (they have no device)", async () => {
    vi.mocked(activitiesService.claimDueReminders).mockResolvedValue([reminder({ assignedToPersonId: "p-tech" })] as never);
    expect(await notificationsService.sendDueTaskReminders(NOW)).toEqual({ reminders: 1, delivered: 0 });
  });

  it("an unassigned task goes to the whole team", async () => {
    vi.mocked(activitiesService.claimDueReminders).mockResolvedValue([reminder()] as never);
    await notificationsService.sendDueTaskReminders(NOW);
    expect(notificationsRepository.findByUserIds).toHaveBeenCalledWith(["u1", "u2"]);
  });

  it("forgets subscriptions the push service reports as gone", async () => {
    vi.mocked(activitiesService.claimDueReminders).mockResolvedValue([reminder()] as never);
    vi.mocked(notificationsRepository.findByUserIds).mockResolvedValue([sub("live"), sub("dead")]);
    vi.mocked(sendPush).mockImplementation(async (target) => (target.endpoint.endsWith("dead") ? "gone" : "sent"));
    const result = await notificationsService.sendDueTaskReminders(NOW);
    expect(notificationsRepository.deleteByIds).toHaveBeenCalledWith(["dead"]);
    expect(result.delivered).toBe(1);
  });

  it("one workspace failing doesn't stop the others", async () => {
    vi.mocked(tenancyService.listTenants).mockResolvedValue([{ id: "broken", slug: "broken", name: "B" }, { id: "t1", slug: "acme", name: "Acme" }]);
    vi.mocked(activitiesService.claimDueReminders).mockImplementation(async (tenantId) => {
      if (tenantId === "broken") throw new Error("db down");
      return [reminder()] as never;
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await notificationsService.sendDueTaskReminders(NOW)).toEqual({ reminders: 1, delivered: 1 });
  });

  it("refuses to run without VAPID keys instead of silently claiming reminders it can't send", async () => {
    vi.mocked(isPushConfigured).mockReturnValue(false);
    await expect(notificationsService.sendDueTaskReminders(NOW)).rejects.toThrow("VAPID");
    expect(activitiesService.claimDueReminders).not.toHaveBeenCalled();
  });
});

describe("sendTest", () => {
  it("asks the person to turn notifications on when this account has no device", async () => {
    vi.mocked(notificationsRepository.findByUserIds).mockResolvedValue([]);
    await expect(notificationsService.sendTest("u1", "acme")).rejects.toThrow("Turn notifications on");
  });

  it("sends to the person's own devices", async () => {
    expect(await notificationsService.sendTest("u1", "acme")).toEqual({ sent: 1 });
    expect(notificationsRepository.findByUserIds).toHaveBeenCalledWith(["u1"]);
  });
});

describe("sendDueL10Reminders", () => {
  const due = {
    tenantId: "t1",
    slug: "grounded",
    workspaceName: "Grounded",
    meetingAt: new Date("2026-10-13T15:00:00Z"),
    timezone: "America/Phoenix",
    topIssues: ["Home inspectors are a channel"],
    offGoal: ["Active customers"],
    offTrackRocks: [],
    openTodos: 4,
    people: [
      { name: "Jay", email: "jay@x.test", userId: "u-jay" },
      { name: "Rex", email: "rex@x.test", userId: null },
      { name: "Kody", email: null, userId: "u-kody" },
    ],
  };

  it("pushes to everyone with a login and emails everyone with an address, with the meeting's points", async () => {
    vi.mocked(tractionService.claimDueL10Reminders).mockResolvedValue([due]);
    vi.mocked(sendEmail).mockResolvedValue(true);
    const result = await notificationsService.sendDueL10Reminders(NOW);
    expect(notificationsRepository.findByUserIds).toHaveBeenCalledWith(["u-jay", "u-kody"]);
    expect(sendPush).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ url: "/w/grounded/traction/l10", body: "Top issue: Home inspectors are a channel" }));
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({ to: "jay@x.test", subject: "L10 in one hour · Grounded" });
    expect(vi.mocked(sendEmail).mock.calls[0][0].text).toContain("Active customers");
    expect(result).toEqual({ meetings: 1, pushed: 1, emailed: 2 });
  });

  it("still emails when push isn't configured", async () => {
    vi.mocked(isPushConfigured).mockReturnValue(false);
    vi.mocked(tractionService.claimDueL10Reminders).mockResolvedValue([due]);
    vi.mocked(sendEmail).mockResolvedValue(true);
    expect(await notificationsService.sendDueL10Reminders(NOW)).toEqual({ meetings: 1, pushed: 0, emailed: 2 });
    expect(sendPush).not.toHaveBeenCalled();
  });
});

describe("notifyAssigned", () => {
  const tanner = { id: "u1", name: "Tanner" };

  it("pushes a new task to its assignee's devices, saying who it came from", async () => {
    await notificationsService.notifyAssigned("t1", "acme", [reminder({ assignedToPersonId: "p2" })], tanner);
    expect(notificationsRepository.findByUserIds).toHaveBeenCalledWith(["u2"]);
    expect(sendPush).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://fcm.googleapis.com/s1" }),
      expect.objectContaining({ title: "New call for you", url: "/w/acme/activities?activity=act-1", tag: "activity-assigned-act-1" })
    );
    expect(vi.mocked(sendPush).mock.calls[0][1]).toMatchObject({ body: expect.stringContaining("Call the seller") });
    expect(vi.mocked(sendPush).mock.calls[0][1]).toMatchObject({ body: expect.stringContaining("from Tanner") });
  });

  it("stays quiet when you assign something to yourself, to someone with no login, or to no one", async () => {
    await notificationsService.notifyAssigned(
      "t1",
      "acme",
      [reminder({ assignedToPersonId: "p1" }), reminder({ assignedToPersonId: "p-tech" }), reminder({ assignedToPersonId: null })],
      tanner
    );
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("never throws — a failed push must not undo the save", async () => {
    vi.mocked(teamService.listPeople).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notificationsService.notifyAssigned("t1", "acme", [reminder({ assignedToPersonId: "p2" })], tanner)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
