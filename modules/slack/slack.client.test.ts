import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { slackClient } from "./slack.client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ok = (body: object) => new Response(JSON.stringify({ ok: true, ...body }));

describe("slackClient", () => {
  it("reads a user with a FORM body — Slack ignores JSON on users.info and answers user_not_found", async () => {
    fetchMock.mockResolvedValue(ok({ user: { tz: "America/Phoenix", profile: { email: "Boss@Tagr.com", real_name: "Boss" } } }));
    const user = await slackClient.getUser("U123");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(init.body.toString()).toBe("user=U123");
    expect(user).toEqual({ email: "boss@tagr.com", name: "Boss", timeZone: "America/Phoenix" });
  });

  it("posts messages as JSON (blocks need it)", async () => {
    fetchMock.mockResolvedValue(ok({ ts: "9.9" }));
    await slackClient.postMessage({ channel: "C1", text: "hi", threadTs: "1.1", blocks: [{ type: "section" }] });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toContain("application/json");
    expect(JSON.parse(init.body)).toMatchObject({ channel: "C1", thread_ts: "1.1", blocks: [{ type: "section" }] });
  });

  it("turns Slack's ok:false into an error", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "channel_not_found" })));
    await expect(slackClient.postMessage({ channel: "C1", text: "hi" })).rejects.toThrow("channel_not_found");
  });
});
