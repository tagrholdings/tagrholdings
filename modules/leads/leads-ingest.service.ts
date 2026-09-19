import { createHash } from "node:crypto";
import { UserFacingError } from "@/lib/errors";
import { safeFetchText } from "@/lib/safe-fetch";
import { htmlToText } from "@/lib/html-text";
import { firstUrlIn, hostOf, isSingleUrl, normalizeUrlForDedupe } from "@/utils/url";
import { leadsRepository } from "./leads.repository";
import { leadExtractionService, type ExtractionInput } from "@/modules/lead-extraction/lead-extraction.service";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import type { UsageEventInput } from "@/modules/lead-engine/lead-engine.types";
import type { ExtractedFields, LeadSourceType } from "./leads.schema";
import { MAX_RAW_TEXT_CHARS, type IngestResult, type QuickAddResult } from "./leads.types";

/**
 * Leads that arrive in REAL TIME rather than from the scheduled scraper: a URL + text handed to
 * POST /api/leads/ingest, a link or paste in the Leads Inbox, an email received by the Resend
 * webhook. One service, several entry points (a Route Handler, a Server Action, a webhook) — the
 * ingestion logic exists exactly once, here.
 */

/** What ingesting one lead needs, whichever door it came through. */
export interface IngestCore {
  sourceType: Extract<LeadSourceType, "manual_assist" | "email_digest">;
  sourceUrl: string | null;
  rawText: string;
  businessName?: string | null;
  /** Name to use when neither the caller nor the AI produced one (an email's subject, say). */
  fallbackName?: string | null;
  note?: string | null;
  /** Identity within (tenant, sourceType) — makes re-submitting the same thing a no-op. */
  dedupeKey: string;
  hints?: ExtractionInput["hints"];
  /** Spend that comes with this lead besides the AI call (e.g. the inbound email itself). */
  extraUsage?: UsageEventInput[];
}

const MAX_STORED_TEXT = 50_000;

function textHash(text: string) {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex").slice(0, 24);
}

export const leadsIngestService = {
  /**
   * dedupe -> AI extraction -> record its spend -> save. Extraction runs only for a lead that is
   * actually new, so a re-submission costs nothing. A failed AI step never loses the lead — it is
   * saved with the source's own fields.
   */
  async ingestRaw(tenantId: string, core: IngestCore): Promise<IngestResult> {
    const existing = await leadsRepository.findIdByDedupeKey(tenantId, core.sourceType, core.dedupeKey);
    if (existing) return { id: existing, duplicate: true, extractionFallback: false };

    const host = core.sourceUrl ? hostOf(core.sourceUrl) : "";
    const extraction = await leadExtractionService.extract({
      // "(not provided)", not the host: given a domain as the "name", the model tends to just echo it back.
      businessName: core.businessName?.trim() || core.fallbackName?.trim() || "(not provided)",
      sourceType: core.sourceType,
      text: core.note ? `Note from the person who added this: ${core.note}\n\n${core.rawText}` : core.rawText,
      hints: { website: core.sourceType === "manual_assist" ? core.sourceUrl : null, ...core.hints },
    });

    // The money is spent whether or not the save below works, so it is logged first (and never blocks the save).
    for (const usage of [extraction.usage, ...(core.extraUsage ?? [])]) {
      if (!usage) continue;
      await leadEngineService.recordUsage(tenantId, usage).catch((error) => console.error("Could not record lead-engine usage:", error));
    }

    const fields: ExtractedFields = { ...extraction.fields };
    if (core.note) fields.note = core.note;
    const businessName = core.businessName?.trim() || fields.businessName || core.fallbackName?.trim() || host || "Unnamed lead";

    const created = await leadsRepository.createIfNew(tenantId, {
      sourceType: core.sourceType,
      sourceUrl: core.sourceUrl,
      businessName: businessName.slice(0, 300),
      rawText: core.rawText.slice(0, MAX_STORED_TEXT),
      extractedFields: fields,
      dedupeKey: core.dedupeKey,
    });
    if (!created) {
      // Lost a race with an identical submission.
      const winner = await leadsRepository.findIdByDedupeKey(tenantId, core.sourceType, core.dedupeKey);
      if (!winner) throw new Error("Lead insert conflicted but no existing lead was found.");
      return { id: winner, duplicate: true, extractionFallback: extraction.fallback };
    }
    return { id: created.id, duplicate: false, extractionFallback: extraction.fallback };
  },

  /** POST /api/leads/ingest — someone (or something) hands us a URL and the text they got from it. */
  async ingestManual(
    tenantId: string,
    input: { sourceUrl: string; rawText: string; businessName?: string; note?: string }
  ): Promise<IngestResult> {
    return this.ingestRaw(tenantId, {
      sourceType: "manual_assist",
      sourceUrl: input.sourceUrl,
      rawText: input.rawText,
      businessName: input.businessName,
      note: input.note,
      dedupeKey: `url:${normalizeUrlForDedupe(input.sourceUrl)}`,
    });
  },

  /**
   * Leads Inbox quick-add: ONE box that takes a link or pasted text. A lone link is fetched here
   * (user-initiated, a single GET, SSRF-guarded) and its text extracted; if the page can't be read
   * (many listing sites block bots) the lead is still saved with the URL so nothing is lost, and the
   * caller is told to paste the page's text instead.
   */
  async quickAdd(tenantId: string, rawInput: string): Promise<QuickAddResult> {
    const input = rawInput.trim();
    if (!input) throw new UserFacingError("Paste a link or some text.");
    if (input.length > MAX_RAW_TEXT_CHARS) throw new UserFacingError("That is too long — paste less text.");

    if (!isSingleUrl(input)) {
      const url = firstUrlIn(input);
      const result = await this.ingestRaw(tenantId, {
        sourceType: "manual_assist",
        sourceUrl: url,
        rawText: input,
        dedupeKey: url ? `url:${normalizeUrlForDedupe(url)}` : `text:${textHash(input)}`,
      });
      return { ...result, pageFetched: true };
    }

    const dedupeKey = `url:${normalizeUrlForDedupe(input)}`;
    const known = await leadsRepository.findIdByDedupeKey(tenantId, "manual_assist", dedupeKey);
    if (known) return { id: known, duplicate: true, extractionFallback: false, pageFetched: true };

    const page = await safeFetchText(input, { maxBytes: 800_000 });
    const readable = page !== null && page.status >= 200 && page.status < 300 && /html|text/i.test(page.contentType);
    if (!readable) {
      const created = await leadsRepository.createIfNew(tenantId, {
        sourceType: "manual_assist",
        sourceUrl: input,
        businessName: (hostOf(input) || "Unnamed lead").slice(0, 300),
        rawText: "",
        extractedFields: {
          website: input,
          note: "The page could not be read automatically (the site may block bots). Open the link and paste its text into the box to fill in the details.",
        },
        dedupeKey,
      });
      const id = created?.id ?? (await leadsRepository.findIdByDedupeKey(tenantId, "manual_assist", dedupeKey));
      if (!id) throw new Error("Lead insert failed.");
      return { id, duplicate: !created, extractionFallback: true, pageFetched: false };
    }

    const text = /html/i.test(page.contentType) ? htmlToText(page.text) : page.text.trim();
    const result = await this.ingestRaw(tenantId, { sourceType: "manual_assist", sourceUrl: input, rawText: text || input, dedupeKey });
    return { ...result, pageFetched: true };
  },
};
