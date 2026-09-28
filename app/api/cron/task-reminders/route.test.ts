import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/notifications/notifications.service", () => ({ notificationsService: { sendDueTaskReminders: vi.fn() } }));

import { GET, POST } from "./route";
import { notificationsService } from "@/modules/notifications/notifications.service";

const call = (handler: typeof POST, authorization?: string) =>
  handler(new Request("https://crm.example/api/cron/task-reminders", { method: "POST", headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cret-value");
  vi.mocked(notificationsService.sendDueTaskReminders).mockResolvedValue({ reminders: 2, delivered: 3 });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/cron/task-reminders", () => {
  it("rejects a call without the secret and never sends anything", async () => {
    expect((await call(POST)).status).toBe(401);
    expect((await call(POST, "Bearer wrong")).status).toBe(401);
    expect(notificationsService.sendDueTaskReminders).not.toHaveBeenCalled();
  });

  it("is disabled (401) when CRON_SECRET isn't configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(POST, "Bearer ")).status).toBe(401);
    expect(notificationsService.sendDueTaskReminders).not.toHaveBeenCalled();
  });

  it("runs the sweep for a valid secret — via POST or GET (Vercel Cron uses GET)", async () => {
    for (const handler of [POST, GET]) {
      const response = await call(handler, "Bearer s3cret-value");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ reminders: 2, delivered: 3 });
    }
  });

  it("masks a failure as a generic 500", async () => {
    vi.mocked(notificationsService.sendDueTaskReminders).mockRejectedValue(new Error("secret db detail"));
    const response = await call(POST, "Bearer s3cret-value");
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret db detail");
  });
});
