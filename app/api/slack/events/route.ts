import { after, NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/slack-signature";
import { slackService } from "@/modules/slack/slack.service";
import type { SlackEventCallback, SlackMessageEvent } from "@/modules/slack/slack.types";

export const dynamic = "force-dynamic";
// The reply (a Gemini call, maybe with a voice note to download) runs after the 200 — give it room.
export const maxDuration = 60;

/**
 * Slack Events API — messages in the bot's channel, and @mentions of the bot anywhere. The bot turns them into
 * activities (see modules/slack).
 *
 * Configure in the Slack app (slack/manifest.json does it): Event Subscriptions → Request URL
 * `https://crm.tagrholdings.com/api/slack/events` (the CRM host — the marketing host would redirect a POST), events
 * `message.channels`, `message.groups`, `app_mention`.
 *
 * Env: SLACK_SIGNING_SECRET, SLACK_APP_ID — of THIS environment's app (prod and dev are two apps).
 *
 * Slack wants a 2xx within 3 seconds or it retries, so the work runs in `after()` and the answer is always 200 once the
 * signature checks out. A retry (X-Slack-Retry-Num) is acknowledged and dropped; the message-claim table is the
 * backstop for anything that still arrives twice.
 */
export async function POST(request: Request) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  const appId = process.env.SLACK_APP_ID;
  if (!secret || !appId) {
    console.error("slack events: SLACK_SIGNING_SECRET / SLACK_APP_ID is not set.");
    return NextResponse.json({ error: "Slack is not configured." }, { status: 500 });
  }

  // The signature covers the RAW body — read it as text before anything parses it.
  const rawBody = await request.text();
  if (!verifySlackSignature(rawBody, request.headers.get("x-slack-request-timestamp"), request.headers.get("x-slack-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: { type?: string; challenge?: string } & Partial<Omit<SlackEventCallback, "type">>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Slack's one-time check when the Request URL is saved.
  if (body.type === "url_verification") return NextResponse.json({ challenge: body.challenge });
  if (body.type !== "event_callback" || !body.event || !body.team_id || !body.api_app_id) return NextResponse.json({ ignored: true });

  // Another app's delivery (or a misrouted one): not ours to answer.
  if (body.api_app_id !== appId) {
    console.warn(`slack events: delivery for app ${body.api_app_id} reached the app ${appId} endpoint — ignored.`);
    return NextResponse.json({ ignored: true });
  }
  if (request.headers.get("x-slack-retry-num")) return NextResponse.json({ ignored: "retry" });

  const event = body.event;
  if (event.type !== "message" && event.type !== "app_mention") return NextResponse.json({ ignored: true });

  const delivery = { teamId: body.team_id, apiAppId: body.api_app_id };
  after(() => slackService.handleMessage(event as SlackMessageEvent, delivery));
  return NextResponse.json({ ok: true });
}
