import spec from "../../scraper/src/leadengine/shared/lead-engine-spec.json";
import { generateGeminiJson } from "@/lib/gemini";
import type { ExtractedFields, LeadSourceType } from "@/modules/leads/leads.schema";
import type { UsageEventInput } from "@/modules/lead-engine/lead-engine.types";

/**
 * Stage 1 of the two AI stages (.agents/rules/lead-pipeline.md): text about a business -> structured
 * `ExtractedFields`. This is the app-side twin of scraper/src/leadengine/extraction/ — the job extracts
 * scraped leads, the app extracts the ones that arrive in real time (manual adds, inbound email).
 * Both read the SAME prompt, output schema and prices from the shared JSON spec, and the field mapping
 * is pinned by a golden fixture that both test suites assert, so they can't drift apart.
 *
 * Two contracts: `extract` (text about ONE business -> one set of fields) and `extractListings` (a marketplace/broker
 * email that lists SEVERAL businesses for sale -> one set of fields per listing).
 *
 * It never scores or ranks — that is the deferred analysis stage.
 */

const EXTRACTION = spec.extraction;
const LISTINGS = spec.listingsExtraction;
const PRICING = spec.pricing;

const SINGLE_MAX_OUTPUT_TOKENS = 800;

export interface ExtractionInput {
  businessName: string;
  sourceType: LeadSourceType;
  text: string;
  /** Facts the source knows for sure (website from a URL, sender email…): fill gaps the model leaves. */
  hints?: { email?: string | null; phone?: string | null; website?: string | null; address?: string | null; industry?: string | null };
}

export interface ExtractionResult {
  fields: ExtractedFields;
  /** null when no billable call happened (no API key, or the request never reached Gemini). */
  usage: UsageEventInput | null;
  /** true when the fields are only the hints — the AI step didn't produce a usable result. */
  fallback: boolean;
}

export interface ExtractedListing {
  fields: ExtractedFields;
  /** The listing's own link — always an http(s) URL that literally appears in the email text, else null. */
  listingUrl: string | null;
}

export interface ListingsExtractionResult {
  listings: ExtractedListing[];
  /** null when no billable call happened. */
  usage: UsageEventInput | null;
  /** true when the AI step failed (no key, HTTP/network error, unusable output) — as opposed to "it ran and found no listings". */
  fallback: boolean;
}

// The model sometimes writes "null" / "N/A" as TEXT for a missing fact; it must not reach the inbox as a value.
const NOT_A_VALUE = /^(null|none|n\/a|na|unknown|not (stated|specified|provided|available))\.?$/i;

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && !NOT_A_VALUE.test(trimmed) ? trimmed : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Model's flat output -> the nested shape the app reads. Mirrors extractor.py's `to_extracted_fields`. */
export function toExtractedFields(
  modelOutput: Record<string, unknown>,
  hints: Record<string, string | null | undefined> = {}
): ExtractedFields {
  const pick = (key: string, hintKey: string = key) => clean(modelOutput[key]) ?? clean(hints[hintKey]);
  const signals = modelOutput.signals;
  return {
    businessName: pick("business_name"),
    industry: pick("industry"),
    summary: clean(modelOutput.summary),
    location: { address: pick("address"), city: pick("city"), state: pick("state") },
    website: pick("website"),
    contact: { name: clean(modelOutput.contact_name), email: pick("contact_email", "email"), phone: pick("contact_phone", "phone") },
    estimatedRevenue: clean(modelOutput.estimated_revenue),
    askingPrice: clean(modelOutput.asking_price),
    reasonForSelling: clean(modelOutput.reason_for_selling),
    employees: clean(modelOutput.employees),
    yearsInBusiness: clean(modelOutput.years_in_business),
    estimatedRevenueUsd: num(modelOutput.estimated_revenue_usd),
    annualProfitUsd: num(modelOutput.annual_profit_usd),
    askingPriceUsd: num(modelOutput.asking_price_usd),
    employeesCount: num(modelOutput.employees_count),
    yearsInBusinessCount: num(modelOutput.years_in_business_count),
    signals: Array.isArray(signals)
      ? signals
          .filter((s): s is string => typeof s === "string" && s.trim() !== "")
          .map((s) => s.trim())
          .slice(0, 6)
      : [],
  };
}

/** USD for one Gemini call at list price (output includes thinking tokens). Unknown models get the conservative fallback rate. Mirrors pricing.py. */
export function geminiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const table = PRICING.geminiUsdPerMillion as Record<string, number[]>;
  const match = Object.keys(table)
    .sort((a, b) => b.length - a.length)
    .find((key) => model.startsWith(key));
  const [rateIn, rateOut] = match ? table[match] : PRICING.geminiFallbackUsdPerMillion;
  return (inputTokens * rateIn + outputTokens * rateOut) / 1_000_000;
}

export const RESEND_INBOUND_USD_PER_EMAIL: number = PRICING.resendInboundUsdPerEmail;

// -- the one place that talks to Gemini ------------------------------------------------------------------------------

type GeminiCall =
  | { status: "ok"; parsed: Record<string, unknown>; usage: UsageEventInput }
  /** Gemini answered (so the call is billed) but the content wasn't a usable JSON object. */
  | { status: "unusable"; usage: UsageEventInput }
  /** No key, HTTP error or network failure — nothing was billed. */
  | { status: "failed" };

async function callGemini(args: { system: string; user: string; schema: unknown; maxTokens: number }): Promise<GeminiCall> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("lead-extraction: GEMINI_API_KEY is not set — saving the lead without AI extraction.");
    return { status: "failed" };
  }
  const result = await generateGeminiJson({ system: args.system, user: args.user, schema: args.schema, maxOutputTokens: args.maxTokens });
  if (result.status === "failed") return { status: "failed" };

  const usage: UsageEventInput = {
    provider: "gemini",
    operation: "extract",
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: geminiCostUsd(result.model, result.inputTokens, result.outputTokens),
  };
  return result.status === "ok" ? { status: "ok", parsed: result.parsed, usage } : { status: "unusable", usage };
}

// -- one business ------------------------------------------------------------------------------------------------------

function userMessage(input: ExtractionInput) {
  return (
    `Source type: ${input.sourceType}\n` +
    `Name as listed by the source: ${input.businessName}\n\n` +
    `--- BEGIN SCRAPED TEXT ---\n${input.text.slice(0, EXTRACTION.maxInputChars)}\n--- END SCRAPED TEXT ---`
  );
}

function fromHintsOnly(input: ExtractionInput): ExtractedFields {
  const hints = input.hints ?? {};
  return toExtractedFields(
    { business_name: input.businessName, website: hints.website, address: hints.address, contact_phone: hints.phone, industry: hints.industry },
    hints
  );
}

// -- a digest of listings -----------------------------------------------------------------------------------------------

/**
 * A listing's link is only trusted if it is an http(s) URL that appears LITERALLY in the text the model was given —
 * the model must not be able to hand us a URL it made up (or one smuggled in by the email's own text via prompt injection
 * that isn't really there). Anything else becomes null.
 */
function verifiedListingUrl(value: unknown, sourceText: string): string | null {
  const candidate = clean(value);
  if (!candidate || candidate.length > 2048) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return sourceText.includes(candidate) ? candidate : null;
}

export function parseListings(parsed: Record<string, unknown>, sourceText: string): ExtractedListing[] {
  const raw = Array.isArray(parsed.listings) ? parsed.listings : [];
  const listings: ExtractedListing[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const fields = toExtractedFields(record);
    const listingUrl = verifiedListingUrl(record.listing_url, sourceText);
    // A listing needs at least a title or a link to be worth a row.
    if (!fields.businessName && !listingUrl) continue;
    listings.push({ fields, listingUrl });
    if (listings.length >= LISTINGS.maxListings) break;
  }
  return listings;
}

export const leadExtractionService = {
  /**
   * Never throws: a lead whose AI step fails is still worth saving, so failures return the hint-only
   * fields with `fallback: true` (and `usage` only if Gemini actually answered, i.e. the call is billed).
   */
  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const call = await callGemini({
      system: EXTRACTION.systemPrompt,
      user: userMessage(input),
      schema: EXTRACTION.outputSchema,
      maxTokens: SINGLE_MAX_OUTPUT_TOKENS,
    });
    if (call.status === "ok") {
      return { fields: toExtractedFields(call.parsed, input.hints as Record<string, string | null | undefined>), usage: call.usage, fallback: false };
    }
    if (call.status === "unusable") console.error("lead-extraction: keeping the source's own fields.");
    return { fields: fromHintsOnly(input), usage: call.status === "unusable" ? call.usage : null, fallback: true };
  },

  /**
   * A marketplace/broker email that lists several businesses for sale -> one entry per listing, in one AI call.
   * Never throws. `fallback` means the AI step failed (the caller keeps the email as a single plain lead); an empty
   * `listings` with `fallback: false` means the AI ran and found no business for sale in it.
   */
  async extractListings(input: { text: string; sourceType: LeadSourceType }): Promise<ListingsExtractionResult> {
    const text = input.text.slice(0, LISTINGS.maxInputChars);
    const call = await callGemini({
      system: LISTINGS.systemPrompt,
      user: `Source type: ${input.sourceType}\n\n--- BEGIN EMAIL TEXT ---\n${text}\n--- END EMAIL TEXT ---`,
      schema: LISTINGS.outputSchema,
      maxTokens: LISTINGS.maxOutputTokens,
    });
    if (call.status === "ok") return { listings: parseListings(call.parsed, text), usage: call.usage, fallback: false };
    return { listings: [], usage: call.status === "unusable" ? call.usage : null, fallback: true };
  },
};
