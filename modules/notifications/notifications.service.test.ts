import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./notifications.repository", () => ({
  notificationsRepository: { upsert: vi.fn(), deleteOwnByEndpoint: vi.fn(), deleteByIds: vi.fn(), findByUserIds: vi.fn() },
}));
vi.mock("@/lib/web-push", () => ({ isPushConfigured: vi.fn(), sendPush: vi.fn() }));
vi.mock("@/modules/activities/activities.service", () => ({ activitiesService: { claimDueReminders: vi.fn() } }));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { listTenantIds: vi.fn(), listMembers: vi.fn() } }));

import { notificationsService } from "./notifications.service";
import { notificationsRepository } from "./notifications.repository";
import { isPushConfigured, sendPush } from "@/lib/web-push";
import { activitiesService } from "@/modules/activities/activities.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

const NOW = new Date("2026-09-28T15:00:00Z");
const sub = (id: string) => ({ id, endpoint: `https://fcm.googleapis.com/${id}`, p256dh: "k", auth: "a" });
const reminder = (over: Partial<{ id: string; assignedToUserId: string | null }> = {}) => ({
  id: "act-1",
  type: "call",
  subject: "Call the seller",
  dueDate: NOW,
  assignedToUserId: null,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isPushConfigured).mockReturnValue(true);
  vi.mocked(sendPush).mockResolvedValue("sent");
  vi.mocked(tenancyService.listTenantIds).mockResolvedValue(["t1"]);
  vi.mocked(tenancyService.listMembers).mockResolvedValue([
    { id: "u1", name: "Tanner", email: "t@x.com" },
    { id: "u2", name: "Matheus", email: "m@x.com" },
  ]);
  vi.mocked(notificationsRepository.findByUserIds).mockResolvedValue([sub("s1")]);
});

describe("subscribe", () => {
  const input = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } };

  it("stores the subscription for the signed-in user", async () => {
    await notificationsService.subscribe("t1", "u1", input);
    expect(notificationsRepository.upsert).toHaveBeenCalledWith("t1", "u1", input);
  });

  it("refuses an endpoint that isn't a known push service (the server POSTs to it)", async () => {
    await expect(notificationsService.subscribe("t1", "u1", { ...input, endpoint: "https://169.254.169.254/latest" })).rejects.toThrow("isn't supported");
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
    vi.mocked(activitiesService.claimDueReminders).mockResolvedValue([reminder({ assignedToUserId: "u2" })] as never);
    const result = await notificationsService.sendDueTaskReminders(NOW);
    expect(notificationsRepository.findByUserIds).toHaveBeenCalledWith("t1", ["u2"]);
    expect(sendPush).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://fcm.googleapis.com/s1" }),
      expect.objectContaining({ title: "Call the seller", body: "Call due now", url: "/activities?activity=act-1", tag: "activity-act-1" })
    );
    expect(result).toEqual({ reminders: 1, delivered: 1 });
  });

  it("an unassigned task goes to the whole team", async () => {
    vi.mocked(activitiesService.claimDueReminders).mockResolvedValue([reminder()] as never);
    await notificationsService.sendDueTaskReminders(NOW);
    expect(notificationsRepository.findByUserIds).toHaveBeenCalledWith("t1", ["u1", "u2"]);
  });

  it("forgets subscriptions the push service reports as gone", async () => {
    vi.mocked(activitiesService.claimDueReminders).mockResolvedValue([reminder()] as never);
    vi.mocked(notificationsRepository.findByUserIds).mockResolvedValue([sub("live"), sub("dead")]);
    vi.mocked(sendPush).mockImplementation(async (target) => (target.endpoint.endsWith("dead") ? "gone" : "sent"));
    const result = await notificationsService.sendDueTaskReminders(NOW);
    expect(notificationsRepository.deleteByIds).toHaveBeenCalledWith("t1", ["dead"]);
    expect(result.delivered).toBe(1);
  });

  it("one workspace failing doesn't stop the others", async () => {
    vi.mocked(tenancyService.listTenantIds).mockResolvedValue(["broken", "t1"]);
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
    await expect(notificationsService.sendTest("t1", "u1")).rejects.toThrow("Turn notifications on");
  });

  it("sends to the person's own devices", async () => {
    expect(await notificationsService.sendTest("t1", "u1")).toEqual({ sent: 1 });
    expect(notificationsRepository.findByUserIds).toHaveBeenCalledWith("t1", ["u1"]);
  });
});
