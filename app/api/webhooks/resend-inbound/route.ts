import { NextResponse } from "next/server";
import { fetchReceivedEmail, InvalidWebhookSignature, verifyInboundWebhook } from "@/lib/resend-inbound";
import { emailInboundService } from "@/modules/email-inbound/email-inbound.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

/**
 * Resend "email.received" webhook — mail sent to the dedicated leads inbox becomes a lead (or, if it is a
 * listing site's "confirm your subscription" message, confirms that subscription).
 *
 * Configure in Resend: Webhooks → endpoint `https://crm.tagrholdings.com/api/webhooks/resend-inbound`
 * (the CRM host — the marketing host would redirect a POST), event `email.received`.
 *
 * Env: RESEND_WEBHOOK_SECRET (the endpoint's signing secret, `whsec_…`), RESEND_API_KEY (to fetch the
 * body), INBOUND_EMAIL_TENANT_ID (which tenant owns this inbox — one inbox, one tenant for now).
 *
 * Status codes matter: Resend retries anything that isn't 2xx. 401 = bad signature (never retried
 * productively). 5xx = our side is broken or Resend's API was unreachable, so retrying is right.
 */

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("resend-inbound webhook: RESEND_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
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

  // The tenant comes from our own configuration, cross-checked against a real tenant — never from the payload.
  const tenantId = process.env.INBOUND_EMAIL_TENANT_ID?.trim();
  if (!tenantId || !(await tenancyService.tenantExists(tenantId))) {
    console.error("resend-inbound webhook: INBOUND_EMAIL_TENANT_ID is missing or is not a real tenant.");
    return NextResponse.json({ error: "Inbound tenant not configured." }, { status: 500 });
  }

  try {
    // The webhook is metadata only; the body has to be fetched.
    const email = await fetchReceivedEmail(emailId);
    const outcome = await emailInboundService.process(tenantId, {
      emailId,
      from: email.from,
      subject: email.subject,
      text: email.text ?? "",
      html: email.html,
    });
    return NextResponse.json({ received: true, outcome: outcome.kind });
  } catch (error) {
    console.error("resend-inbound webhook failed:", error);
    return NextResponse.json({ error: "Could not process the email." }, { status: 500 });
  }
}
