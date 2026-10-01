import { NextResponse } from "next/server";
import { fetchReceivedEmail, InvalidWebhookSignature, verifyInboundWebhook } from "@/lib/resend-inbound";
import { inboundDomain, inboundLocalPartOf } from "@/lib/inbound-address";
import { emailInboundService } from "@/modules/email-inbound/email-inbound.service";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

/**
 * Resend "email.received" webhook — mail sent to a workspace's leads inbox becomes a lead (or, if it is a listing
 * site's "confirm your subscription" message, confirms that subscription).
 *
 * EVERY WORKSPACE HAS ITS OWN ADDRESS: `<inbound_local_part>@<INBOUND_EMAIL_DOMAIN>` (tenants.inbound_local_part). One
 * Resend receiving domain (catch-all), one webhook and one signing secret serve them all; the email's recipient says
 * which workspace it belongs to, so leads of different companies never mix. A recipient that isn't any workspace's
 * address is acknowledged and dropped.
 *
 * Configure in Resend: Webhooks → endpoint `https://crm.tagrholdings.com/api/webhooks/resend-inbound`
 * (the CRM host — the marketing host would redirect a POST), event `email.received`.
 *
 * Env: RESEND_WEBHOOK_SECRET (the endpoint's signing secret, `whsec_…`), RESEND_API_KEY (to fetch the body),
 * INBOUND_EMAIL_DOMAIN (the receiving domain every workspace address lives on).
 *
 * Status codes matter: Resend retries anything that isn't 2xx. 401 = bad signature (never retried
 * productively). 5xx = our side is broken or Resend's API was unreachable, so retrying is right. "Nobody owns that
 * address" is a 200 — retrying can't fix it.
 */

/** Per workspace: enough for a busy digest subscription, low enough that a leaked address can't run up the AI bill. */
const PER_WORKSPACE_LIMIT = 200;
const PER_WORKSPACE_WINDOW_MS = 60 * 60 * 1000;

const isString = (value: unknown): value is string => typeof value === "string";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("resend-inbound webhook: RESEND_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }
  if (!inboundDomain()) {
    console.error("resend-inbound webhook: INBOUND_EMAIL_DOMAIN is not set.");
    return NextResponse.json({ error: "Inbound domain not configured." }, { status: 500 });
  }

  // The signature covers the RAW body — read it as text before anything parses it.
  const rawBody = await request.text();
  let event;
  try {
    event = verifyInboundWebhook(rawBody, request.headers, secret);
  } catch (error) {
    if (error instanceof InvalidWebhookSignature) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    throw error;
  }

  // Other events on the same endpoint are acknowledged and ignored.
  if (event.type !== "email.received") return NextResponse.json({ ignored: true });
  const emailId = event.data.email_id;
  if (!emailId) return NextResponse.json({ error: "Missing email_id." }, { status: 400 });

  // The event carries the recipients too: mail for no address of ours is dropped before spending an API call on it.
  const hinted = Array.isArray(event.data.to) ? event.data.to.filter(isString) : null;
  if (hinted && !hinted.some((address) => inboundLocalPartOf(address))) return NextResponse.json({ ignored: "not for a workspace inbox" });

  try {
    // The webhook is metadata only; the body has to be fetched. Its `to` is the authority on who the mail was for.
    const email = await fetchReceivedEmail(emailId);

    // The workspace comes from our own database (the address's token), never from anything the sender controls.
    const localParts = [...new Set(email.to.map(inboundLocalPartOf).filter(isString))];
    // An archived workspace no longer takes mail: it is dropped like an address nobody owns.
    const tenants = (await Promise.all(localParts.map((localPart) => tenancyService.findByInboundLocalPart(localPart)))).filter(
      (tenant): tenant is NonNullable<typeof tenant> => !!tenant && !tenant.archivedAt
    );
    if (tenants.length === 0) {
      console.warn("resend-inbound webhook: no workspace owns any recipient of this email — dropped.");
      return NextResponse.json({ ignored: "unknown inbox" });
    }

    // One email addressed to two workspaces becomes leads in both. Every workspace is attempted even if one fails;
    // a failure answers 5xx afterwards so Resend retries (redeliveries are idempotent per workspace and email id).
    let failed = false;
    const outcomes: string[] = [];
    for (const tenant of tenants) {
      try {
        if (await rateLimitService.isLimited(`inbound:tenant:${tenant.id}`, PER_WORKSPACE_LIMIT, PER_WORKSPACE_WINDOW_MS)) {
          console.warn(`resend-inbound webhook: workspace ${tenant.slug} is over its hourly inbound limit — dropped.`);
          outcomes.push("rate_limited");
          continue;
        }
        const outcome = await emailInboundService.process(tenant.id, {
          emailId,
          from: email.from,
          subject: email.subject,
          text: email.text ?? "",
          html: email.html,
        });
        outcomes.push(outcome.kind);
      } catch (error) {
        failed = true;
        console.error(`resend-inbound webhook failed for workspace ${tenant.slug}:`, error);
      }
    }
    if (failed) return NextResponse.json({ error: "Could not process the email." }, { status: 500 });
    return NextResponse.json({ received: true, outcome: outcomes[0], workspaces: outcomes.length });
  } catch (error) {
    console.error("resend-inbound webhook failed:", error);
    return NextResponse.json({ error: "Could not process the email." }, { status: 500 });
  }
}
