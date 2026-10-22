import "server-only";
import type { AudioInput, SlackFile, SlackThreadMessage } from "./slack.types";

/**
 * The only place that talks to Slack's Web API, with the bot token of THIS environment's app (the prod and dev apps each
 * have their own — see slack/README.md). Slack answers 200 with `ok: false` for most failures, so every call checks it.
 *
 * Env: SLACK_BOT_TOKEN. Scopes: chat:write, users:read, users:read.email, files:read.
 */
const API = "https://slack.com/api";
const TIMEOUT_MS = 15_000;
/** Gemini takes audio inline (the whole request must stay under ~20 MB, base64 adds a third). */
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export class SlackApiError extends Error {}

function token(): string {
  const value = process.env.SLACK_BOT_TOKEN;
  if (!value) throw new SlackApiError("SLACK_BOT_TOKEN is not set.");
  return value;
}

/**
 * Slack reads JSON bodies only on its write methods (chat.postMessage, chat.update…). Read methods such as users.info
 * ignore a JSON body and answer as if no argument was sent (`user_not_found`) — they take a form body.
 */
async function call<T>(method: string, body: Record<string, unknown>, encoding: "json" | "form" = "json"): Promise<T> {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": encoding === "json" ? "application/json; charset=utf-8" : "application/x-www-form-urlencoded",
    },
    body: encoding === "json" ? JSON.stringify(body) : new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new SlackApiError(`${method} answered ${response.status}`);
  const json = (await response.json()) as { ok: boolean; error?: string } & T;
  if (!json.ok) throw new SlackApiError(`${method}: ${json.error ?? "unknown error"}`);
  return json;
}

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: unknown[];
  /** Replies go in the thread of the message that asked. */
  threadTs?: string;
}

export const slackClient = {
  async postMessage({ channel, text, blocks, threadTs }: SlackMessage): Promise<{ ts: string }> {
    const result = await call<{ ts: string }>("chat.postMessage", { channel, text, blocks, thread_ts: threadTs, unfurl_links: false });
    return { ts: result.ts };
  },

  async updateMessage({ channel, ts, text, blocks }: { channel: string; ts: string; text: string; blocks?: unknown[] }) {
    await call("chat.update", { channel, ts, text, blocks });
  },

  /** Who a Slack user is: the e-mail that links them to a workspace member, and the time zone their "Friday at 2pm" is in. */
  async getUser(userId: string): Promise<{ email: string | null; name: string; timeZone: string }> {
    const result = await call<{ user: { real_name?: string; name?: string; tz?: string; profile?: { email?: string; real_name?: string; display_name?: string } } }>("users.info", { user: userId }, "form");
    const { user } = result;
    return {
      email: user.profile?.email?.toLowerCase() ?? null,
      name: user.profile?.real_name || user.real_name || user.profile?.display_name || user.name || "there",
      timeZone: user.tz || "America/Phoenix",
    };
  },

  /** A thread, oldest first (the root message included). Needs channels:history / groups:history. */
  async getThread(channel: string, threadTs: string): Promise<SlackThreadMessage[]> {
    const result = await call<{ messages?: SlackThreadMessage[] }>("conversations.replies", { channel, ts: threadTs, limit: 200 }, "form");
    return result.messages ?? [];
  },

  /** A voice note / audio file, downloaded with the bot token (Slack's file URLs aren't public). Null when it isn't usable audio. */
  async downloadAudio(file: SlackFile): Promise<AudioInput | { tooBig: true } | null> {
    const url = file.url_private_download ?? file.url_private;
    const mimeType = file.mimetype ?? "";
    if (!url || !(mimeType.startsWith("audio/") || mimeType.startsWith("video/"))) return null;
    if ((file.size ?? 0) > MAX_AUDIO_BYTES) return { tooBig: true };

    const response = await fetch(url, { headers: { Authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(TIMEOUT_MS * 2), redirect: "follow" });
    if (!response.ok) throw new SlackApiError(`file download answered ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_AUDIO_BYTES) return { tooBig: true };
    return { mimeType, data: bytes.toString("base64") };
  },
};
