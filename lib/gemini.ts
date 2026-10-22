import "server-only";

/**
 * A thin Gemini client (REST, no SDK — like the OpenAI call in lead-extraction): one `generateContent` turn with
 * function calling. The caller runs the loop. Audio goes in as an `inlineData` part, so a voice note needs no separate
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
