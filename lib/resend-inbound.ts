import "server-only";
import { Resend } from "resend";

/**
 * Resend's inbound-email plumbing, kept out of the route so the route stays thin and the module
 * logic stays testable. Two calls:
 *   - verifyInboundWebhook: Resend signs webhooks with Svix. The SDK checks the HMAC over
 *     `${svix-id}.${svix-timestamp}.${rawBody}` and the timestamp (replay window) and THROWS if anything
 *     is off — so a request only gets past this with a payload Resend itself signed with our secret.
 *   - fetchReceivedEmail: the `email.received` webhook carries metadata only; the body comes from the API.
 */

export interface InboundWebhookEvent {
  type: string;
  data: { email_id?: string } & Record<string, unknown>;
}

export interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
}

export class InvalidWebhookSignature extends Error {}

export function verifyInboundWebhook(rawBody: string, headers: Headers, secret: string): InboundWebhookEvent {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) throw new InvalidWebhookSignature("Missing Svix headers.");

  try {
    // Verification is local (no network); the API key isn't used for it.
    return new Resend("re_signature_check").webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    }) as unknown as InboundWebhookEvent;
  } catch (error) {
    throw new InvalidWebhookSignature(error instanceof Error ? error.message : "Invalid signature.");
  }
}

export async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
  const { data, error } = await new Resend(apiKey).emails.receiving.get(emailId);
  if (error || !data) throw new Error(`Could not fetch received email ${emailId}: ${error?.message ?? "no data"}`);
  return { id: data.id, from: data.from, to: data.to, subject: data.subject, text: data.text, html: data.html };
}
