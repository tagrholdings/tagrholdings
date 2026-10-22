import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const handleInteraction = vi.hoisted(() => vi.fn());
vi.mock("@/modules/slack/slack.service", () => ({ slackService: { handleMessage: vi.fn(), handleInteraction } }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { POST } from "./route";

const SECRET = "signing-secret";
const APP = "A111";

function signed(payload: unknown, secret = SECRET) {
  const raw = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
  return new Request("http://localhost/api/slack/interactions", {
    method: "POST",
    headers: { "x-slack-request-timestamp": timestamp, "x-slack-signature": signature, "content-type": "application/x-www-form-urlencoded" },
    body: raw,
  });
}

const click = { type: "block_actions", api_app_id: APP, team: { id: "T1" }, user: { id: "U1" }, actions: [{ action_id: "slack_confirm", value: "abc" }] };

describe("POST /api/slack/interactions", () => {
  beforeEach(() => {
    handleInteraction.mockReset();
    vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
    vi.stubEnv("SLACK_APP_ID", APP);
  });

  it("rejects a bad signature", async () => {
    expect((await POST(signed(click, "wrong"))).status).toBe(401);
    expect(handleInteraction).not.toHaveBeenCalled();
  });

  it("hands a button press to the service", async () => {
    expect((await POST(signed(click))).status).toBe(200);
    expect(handleInteraction).toHaveBeenCalledWith(click, { teamId: "T1", apiAppId: APP });
  });

  it("hands a message shortcut to the service the same way", async () => {
    const shortcut = { type: "message_action", callback_id: "create_task_from_message", api_app_id: APP, team: { id: "T1" }, user: { id: "U1" }, channel: { id: "C1" }, message: { ts: "1.1", text: "do it" } };
    expect((await POST(signed(shortcut))).status).toBe(200);
    expect(handleInteraction).toHaveBeenCalledWith(shortcut, { teamId: "T1", apiAppId: APP });
  });

  it("drops a press meant for another app", async () => {
    expect((await POST(signed({ ...click, api_app_id: "A999" }))).status).toBe(200);
    expect(handleInteraction).not.toHaveBeenCalled();
  });
});
