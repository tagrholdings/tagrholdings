import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMessage = vi.hoisted(() => vi.fn());
vi.mock("@/modules/slack/slack.service", () => ({ slackService: { handleMessage, handleInteraction: vi.fn() } }));
// `after()` needs a request scope; here it just runs the callback.
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { POST } from "./route";

const SECRET = "signing-secret";
const APP = "A111";

function signed(body: unknown, headers: Record<string, string> = {}, overrides: { timestamp?: string; secret?: string } = {}) {
  const raw = JSON.stringify(body);
  const timestamp = overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = `v0=${createHmac("sha256", overrides.secret ?? SECRET).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
  return new Request("http://localhost/api/slack/events", {
    method: "POST",
    headers: { "x-slack-request-timestamp": timestamp, "x-slack-signature": signature, "content-type": "application/json", ...headers },
    body: raw,
  });
}

const callback = (event: Record<string, unknown>, over: Record<string, unknown> = {}) => ({ type: "event_callback", team_id: "T1", api_app_id: APP, event, ...over });

describe("POST /api/slack/events", () => {
  beforeEach(() => {
    handleMessage.mockReset();
    vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
    vi.stubEnv("SLACK_APP_ID", APP);
  });

  it("is disabled (500) without its env", async () => {
    vi.stubEnv("SLACK_SIGNING_SECRET", "");
    expect((await POST(signed({}))).status).toBe(500);
  });

  it("rejects a bad signature and a stale timestamp", async () => {
    expect((await POST(signed(callback({ type: "message" }), {}, { secret: "wrong" }))).status).toBe(401);
    expect((await POST(signed(callback({ type: "message" }), {}, { timestamp: "1000" }))).status).toBe(401);
    expect(handleMessage).not.toHaveBeenCalled();
  });

  it("answers Slack's url_verification challenge", async () => {
    const response = await POST(signed({ type: "url_verification", challenge: "abc" }));
    expect(await response.json()).toEqual({ challenge: "abc" });
  });

  it("hands a message to the service with the team and app of the delivery", async () => {
    const event = { type: "message", user: "U1", text: "call João", ts: "1.1", channel: "C1" };
    const response = await POST(signed(callback(event)));
    expect(response.status).toBe(200);
    expect(handleMessage).toHaveBeenCalledWith(event, { teamId: "T1", apiAppId: APP });
  });

  it("ignores another app's delivery, Slack retries, and other event types", async () => {
    await POST(signed(callback({ type: "message", ts: "1.1" }, { api_app_id: "A999" })));
    await POST(signed(callback({ type: "message", ts: "1.1" }), { "x-slack-retry-num": "1" }));
    await POST(signed(callback({ type: "reaction_added" })));
    expect(handleMessage).not.toHaveBeenCalled();
  });

  it("answers 400 to a signed body that isn't JSON", async () => {
    const raw = "not json";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `v0=${createHmac("sha256", SECRET).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
    const response = await POST(new Request("http://localhost/api/slack/events", { method: "POST", headers: { "x-slack-request-timestamp": timestamp, "x-slack-signature": signature }, body: raw }));
    expect(response.status).toBe(400);
  });
});
