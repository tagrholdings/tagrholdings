import { after, NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/slack-signature";
import { slackService } from "@/modules/slack/slack.service";
import type { SlackInteractionPayload } from "@/modules/slack/slack.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Slack Interactivity — the Create / Cancel buttons on the bot's cards.
 *
 * Configure in the Slack app (slack/manifest.json does it): Interactivity → Request URL
 * `https://crm.tagrholdings.com/api/slack/interactions`. Slack POSTs a form (`payload=<json>`), signed like the events.
 *
 * Env: SLACK_SIGNING_SECRET, SLACK_APP_ID. Answers 200 at once; the write runs in `after()` and the card is edited when done.
 */
export async function POST(request: Request) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  const appId = process.env.SLACK_APP_ID;
  if (!secret || !appId) {
    console.error("slack interactions: SLACK_SIGNING_SECRET / SLACK_APP_ID is not set.");
    return NextResponse.json({ error: "Slack is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!verifySlackSignature(rawBody, request.headers.get("x-slack-request-timestamp"), request.headers.get("x-slack-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: SlackInteractionPayload;
  try {
    payload = JSON.parse(new URLSearchParams(rawBody).get("payload") ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const teamId = payload.team?.id;
  // Button presses carry the app id; a MESSAGE SHORTCUT payload does not. The signature already proves the request came from
  // this environment's app (the signing secret is per app), so a missing id is fine — only a different one is refused.
  if (!teamId || (payload.api_app_id && payload.api_app_id !== appId)) return new NextResponse(null, { status: 200 });

  after(() => slackService.handleInteraction(payload, { teamId, apiAppId: appId }));
  return new NextResponse(null, { status: 200 });
}
