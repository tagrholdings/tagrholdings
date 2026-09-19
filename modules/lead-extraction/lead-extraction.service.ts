import spec from "../../scraper/src/leadengine/shared/lead-engine-spec.json";
import type { ExtractedFields, LeadSourceType } from "@/modules/leads/leads.schema";
import type { UsageEventInput } from "@/modules/lead-engine/lead-engine.types";

/**
 * Stage 1 of the two AI stages (.agents/rules/lead-pipeline.md): text about a business -> structured
 * `ExtractedFields`. This is the app-side twin of scraper/src/leadengine/extraction/ — the job extracts
 * scraped leads, the app extracts the ones that arrive in real time (manual adds, inbound email).
 * Both read the SAME prompt, output schema and prices from the shared JSON spec, and the field mapping
 * is pinned by a golden fixture that both test suites assert, so they can't drift apart.
 *
 * It never scores or ranks — that is the deferred analysis stage.
 */

const EXTRACTION = spec.extraction;
const PRICING = spec.pricing;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 45_000;

export interface ExtractionInput {
  businessName: string;
  sourceType: LeadSourceType;
  text: string;
  /** Facts the source knows for sure (website from a URL, sender email…): fill gaps the model leaves. */
  hints?: { email?: string | null; phone?: string | null; website?: string | null; address?: string | null; industry?: string | null };
}

export interface ExtractionResult {
  fields: ExtractedFields;
  /** null when no billable call happened (no API key, or the request never reached OpenAI). */
  usage: UsageEventInput | null;
  /** true when the fields are only the hints — the AI step didn't produce a usable result. */
  fallback: boolean;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
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

/** USD for one OpenAI call at list price. Unknown models get the conservative fallback rate. Mirrors pricing.py. */
export function openAiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const table = PRICING.openaiUsdPerMillion as Record<string, number[]>;
  const match = Object.keys(table)
    .sort((a, b) => b.length - a.length)
    .find((key) => model.startsWith(key));
  const [rateIn, rateOut] = match ? table[match] : PRICING.openaiFallbackUsdPerMillion;
  return (inputTokens * rateIn + outputTokens * rateOut) / 1_000_000;
}

export const RESEND_INBOUND_USD_PER_EMAIL: number = PRICING.resendInboundUsdPerEmail;

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

export const leadExtractionService = {
  /**
   * Never throws: a lead whose AI step fails is still worth saving, so failures return the hint-only
   * fields with `fallback: true` (and `usage` only if OpenAI actually answered, i.e. the call is billed).
   */
  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("lead-extraction: OPENAI_API_KEY is not set — saving the lead without AI extraction.");
      return { fields: fromHintsOnly(input), usage: null, fallback: true };
    }
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    let body: {
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: { message?: { content?: string | null } }[];
    };
    try {
      const response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: EXTRACTION.systemPrompt },
            { role: "user", content: userMessage(input) },
          ],
          response_format: { type: "json_schema", json_schema: { name: "lead_extraction", strict: true, schema: EXTRACTION.outputSchema } },
          max_completion_tokens: 800,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        console.error(`lead-extraction: OpenAI answered ${response.status}`);
        return { fields: fromHintsOnly(input), usage: null, fallback: true };
      }
      body = await response.json();
    } catch (error) {
      console.error("lead-extraction: OpenAI request failed:", error instanceof Error ? error.message : error);
      return { fields: fromHintsOnly(input), usage: null, fallback: true };
    }

    const inputTokens = body.usage?.prompt_tokens ?? 0;
    const outputTokens = body.usage?.completion_tokens ?? 0;
    const reportedModel = body.model ?? model;
    // OpenAI answered, so the call is billed even if its content turns out unusable below.
    const usage: UsageEventInput = {
      provider: "openai",
      operation: "extract",
      model: reportedModel,
      inputTokens,
      outputTokens,
      costUsd: openAiCostUsd(reportedModel, inputTokens, outputTokens),
    };

    try {
      const parsed = JSON.parse(body.choices?.[0]?.message?.content || "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      return { fields: toExtractedFields(parsed as Record<string, unknown>, input.hints as Record<string, string | null | undefined>), usage, fallback: false };
    } catch {
      console.error("lead-extraction: OpenAI returned non-JSON content — keeping the source's own fields.");
      return { fields: fromHintsOnly(input), usage, fallback: true };
    }
  },
};
