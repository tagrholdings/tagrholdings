import "server-only";

/**
 * A thin Gemini client (REST, no SDK): one `generateContent` turn with function calling (the Slack assistant), and
 * `generateGeminiJson` below for the lead extraction. The caller runs the loop. Audio goes in as an `inlineData` part, so a voice note needs no separate
 * transcription step.
 *
 * Env: GEMINI_API_KEY, GEMINI_MODEL (default below).
 */
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 45_000;

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  /** Opaque; must travel back unchanged with the part it came on, so the model's own turn is replayed as received. */
  thoughtSignature?: string;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GeminiTurn {
  /** The model's turn exactly as received — append it to the conversation before answering its calls. */
  content: GeminiContent;
  calls: { name: string; args: Record<string, unknown> }[];
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** The AI layer is not set up or did not answer: the caller tells the person, it never crashes the webhook. */
export class GeminiUnavailable extends Error {}

/**
 * Plain-JSON generation for the lead extraction (not the Slack bot): one call, the model answers with a JSON object that
 * follows `schema` — Gemini takes the JSON Schema of the shared lead-engine spec as is (`responseJsonSchema`). Never
 * throws: a missing key, an HTTP error or a network failure is `failed` (nothing billed); an answer that isn't a JSON
 * object — or was cut short — is `unusable` (the call happened, so it is billed).
 */
export interface GeminiJsonRequest {
  system: string;
  user: string;
  schema: unknown;
  maxOutputTokens: number;
  model?: string;
}

export type GeminiJsonResult =
  | { status: "ok"; parsed: Record<string, unknown>; model: string; inputTokens: number; outputTokens: number }
  | { status: "unusable"; model: string; inputTokens: number; outputTokens: number }
  | { status: "failed" };

/** Which model reads leads. Separate from GEMINI_MODEL (the Slack bot's): extraction is a cheap, high-volume job. */
export const DEFAULT_EXTRACTION_MODEL = "gemini-2.5-flash";
export const extractionModel = () => process.env.GEMINI_EXTRACTION_MODEL?.trim() || DEFAULT_EXTRACTION_MODEL;

const JSON_TIMEOUT_MS = 45_000;

/**
 * Thinking is billed as output and buys nothing for "copy these facts out of a text" — so it is switched off where the model
 * lets us (the 2.5 Flash family). Other families keep their default; their thinking tokens are counted in the output total.
 */
const thinkingOff = (model: string) => /^gemini-2\.5-flash/.test(model);

export async function generateGeminiJson(request: GeminiJsonRequest): Promise<GeminiJsonResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { status: "failed" };
  const model = request.model ?? extractionModel();

  let body: {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    modelVersion?: string;
  };
  try {
    const response = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.user }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: request.schema,
          ...(thinkingOff(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`lead-extraction: Gemini answered ${response.status}`);
      return { status: "failed" };
    }
    body = await response.json();
  } catch (error) {
    console.error("lead-extraction: Gemini request failed:", error instanceof Error ? error.message : error);
    return { status: "failed" };
  }

  const usage = body.usageMetadata;
  const billed = {
    model: body.modelVersion ?? model,
    inputTokens: usage?.promptTokenCount ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
  };

  const candidate = body.candidates?.[0];
  // A reply cut off by the token limit is invalid JSON by definition: don't try to read half an object.
  if (candidate?.finishReason === "MAX_TOKENS") {
    console.error("lead-extraction: Gemini ran out of output tokens.");
    return { status: "unusable", ...billed };
  }
  try {
    const parsed = JSON.parse(candidate?.content?.parts?.map((p) => p.text ?? "").join("") || "{}");
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return { status: "ok", parsed: parsed as Record<string, unknown>, ...billed };
  } catch {
    console.error("lead-extraction: Gemini returned non-JSON content.");
    return { status: "unusable", ...billed };
  }
}

export type GenerateGemini = (args: { system: string; contents: GeminiContent[]; tools: GeminiTool[] }) => Promise<GeminiTurn>;

/** One turn. The model MUST call one of the tools (mode ANY) — it never replies in free text, so there is nothing to parse. */
export const generateGemini: GenerateGemini = async ({ system, contents, tools }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiUnavailable("GEMINI_API_KEY is not set.");
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  let body: {
    candidates?: { content?: GeminiContent }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  try {
    const response = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: [{ functionDeclarations: tools }],
        toolConfig: { functionCallingConfig: { mode: "ANY" } },
        generationConfig: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new GeminiUnavailable(`Gemini answered ${response.status}`);
    body = await response.json();
  } catch (error) {
    if (error instanceof GeminiUnavailable) throw error;
    throw new GeminiUnavailable(error instanceof Error ? error.message : "Gemini request failed.");
  }

  const content = body.candidates?.[0]?.content;
  if (!content?.parts) throw new GeminiUnavailable("Gemini returned no content.");
  return {
    content: { role: "model", parts: content.parts },
    calls: content.parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} })),
    text: content.parts.map((p) => p.text ?? "").join(""),
    inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
  };
};
