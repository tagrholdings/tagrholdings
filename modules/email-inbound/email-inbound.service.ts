import { safeFetchText } from "@/lib/safe-fetch";
import { htmlToText } from "@/lib/html-text";
import { emailSourcesService } from "@/modules/email-sources/email-sources.service";
import { leadsIngestService } from "@/modules/leads/leads-ingest.service";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { RESEND_INBOUND_USD_PER_EMAIL } from "@/modules/lead-extraction/lead-extraction.service";
import { detectConfirmation, matchSource, senderAddress, senderSiteUrl, type InboundEmail } from "./confirmation";

export interface ReceivedEmailInput extends InboundEmail {
  /** Resend's id for the received email — also the idempotency key (webhooks are retried). */
  emailId: string;
}

export type InboundOutcome =
  | { kind: "subscription_confirmed"; emailSourceId: string }
  | { kind: "confirmation_failed"; emailSourceId: string }
  | { kind: "lead"; leadId: string; duplicate: boolean };

const INBOUND_USAGE = { provider: "resend", operation: "receive", requests: 1, costUsd: RESEND_INBOUND_USD_PER_EMAIL } as const;

/** Enough of a long digest for the AI (which reads ~6k chars) while keeping the stored audit copy bounded. */
const MAX_BODY_CHARS = 30_000;

export const emailInboundService = {
  /**
   * One received email, two possible meanings:
   *   1. a "confirm your subscription" message for a signup we listed -> click the link, mark that source
   *      subscribed, and DO NOT create a lead from it;
   *   2. anything else (or a confirmation we can't confidently match) -> a lead: same AI extraction as every
   *      other source, saved as sourceType "email_digest".
   * A confirmation we can't tie to exactly one listed site falls through to (2) — never guess.
   */
  async process(tenantId: string, email: ReceivedEmailInput): Promise<InboundOutcome> {
    const confirmation = detectConfirmation(email);
    if (confirmation) {
      const sources = await emailSourcesService.listAwaitingConfirmation(tenantId);
      const source = matchSource(sources, email, confirmation.link);
      if (source) {
        // A confirmation email is still an email Resend received (it counts against the quota) — log it, but never fail on it.
        await leadEngineService.recordUsage(tenantId, INBOUND_USAGE).catch((e) => console.error("Could not record inbound usage:", e));
        const page = await safeFetchText(confirmation.link, { timeoutMs: 15_000, maxBytes: 100_000 });
        if (page && page.status >= 200 && page.status < 300) {
          await emailSourcesService.markSubscribedFromConfirmation(tenantId, source.id);
          return { kind: "subscription_confirmed", emailSourceId: source.id };
        }
        // Matched, but the link wouldn't open: leave `subscribed` alone and leave a trace for a human.
        await emailSourcesService.noteConfirmationProblem(
          tenantId,
          source.id,
          `The confirmation link couldn't be opened automatically (${page ? `HTTP ${page.status}` : "blocked or unreachable"}). Open the email and click it by hand.`
        );
        return { kind: "confirmation_failed", emailSourceId: source.id };
      }
    }

    const body = (email.text?.trim() ? email.text : email.html ? htmlToText(email.html) : "").slice(0, MAX_BODY_CHARS);
    const address = senderAddress(email.from);
    const rawText = [`From: ${email.from}`, `Subject: ${email.subject}`, "", body].join("\n");

    const result = await leadsIngestService.ingestRaw(tenantId, {
      sourceType: "email_digest",
      sourceUrl: senderSiteUrl(email.from),
      rawText,
      fallbackName: email.subject.trim() || address || null,
      dedupeKey: `email:${email.emailId}`,
      // The inbound email itself is a (small) billable event — logged as its own service. Not logged when the
      // email was a duplicate delivery, since ingestRaw returns before using it.
      extraUsage: [INBOUND_USAGE],
    });
    return { kind: "lead", leadId: result.id, duplicate: result.duplicate };
  },
};
