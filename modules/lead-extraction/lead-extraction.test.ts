import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import golden from "../../scraper/tests/fixtures/extraction_golden.json";
import spec from "../../scraper/src/leadengine/shared/lead-engine-spec.json";
import { leadExtractionService, openAiCostUsd, toExtractedFields } from "./lead-extraction.service";

describe("field mapping is identical to the Python job's (shared golden fixture)", () => {
  it.each(golden.cases)("$name", ({ modelOutput, hints, expected }) => {
    expect(toExtractedFields(modelOutput as Record<string, unknown>, hints)).toEqual(expected);
  });
});

describe("shared spec", () => {
  it("the strict output schema requires every property it declares (OpenAI strict mode)", () => {
    const { properties, required } = spec.extraction.outputSchema;
    expect([...required].sort()).toEqual(Object.keys(properties).sort());
  });
});

describe("openAiCostUsd", () => {
  it("prices a known model", () => {
    expect(openAiCostUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
  });
  it("matches a dated model name by the longest prefix (mini, not the pricier base model)", () => {
    expect(openAiCostUsd("gpt-4o-mini-2024-07-18", 1_000_000, 0)).toBeCloseTo(0.15, 6);
  });
  it("uses the conservative fallback for an unknown model", () => {
    expect(openAiCostUsd("future-model", 1_000_000, 1_000_000)).toBeCloseTo(2.4, 6);
  });
});

describe("leadExtractionService.extract", () => {
  const input = { businessName: "Cool Air", sourceType: "manual_assist" as const, text: "Owner retiring. Asking $850,000.", hints: { website: "https://coolair.test" } };

  function openAiResponse(content: string, status = 200) {
    return new Response(JSON.stringify({ model: "gpt-4o-mini-2024-07-18", usage: { prompt_tokens: 1000, completion_tokens: 200 }, choices: [{ message: { content } }] }), { status });
  }

  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_MODEL", "");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends the shared prompt + strict schema, maps the answer and prices the call", async () => {
    const content = JSON.stringify({ ...golden.cases[0].modelOutput, business_name: "Cool Air LLC" });
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse(content));
    vi.stubGlobal("fetch", fetchMock);

    const result = await leadExtractionService.extract(input);

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages[0].content).toBe(spec.extraction.systemPrompt);
    expect(body.messages[1].content).toContain("BEGIN SCRAPED TEXT");
    expect(body.response_format.json_schema.strict).toBe(true);

    expect(result.fallback).toBe(false);
    expect(result.fields.businessName).toBe("Cool Air LLC");
    expect(result.fields.askingPriceUsd).toBe(850000);
    // 1000 * 0.15/1M + 200 * 0.60/1M
    expect(result.usage).toMatchObject({ provider: "openai", operation: "extract", inputTokens: 1000, outputTokens: 200 });
    expect(result.usage!.costUsd).toBeCloseTo(0.00027, 8);
  });

  it("truncates what it sends to the model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await leadExtractionService.extract({ ...input, text: "y".repeat(50_000) });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content as string;
    expect(sent.length).toBeLessThan(spec.extraction.maxInputChars + 300);
  });

  it("never throws: an OpenAI error keeps the source's own fields and bills nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    const result = await leadExtractionService.extract(input);
    expect(result).toMatchObject({ fallback: true, usage: null });
    expect(result.fields.businessName).toBe("Cool Air");
    expect(result.fields.website).toBe("https://coolair.test");
  });

  it("a network failure is also a fallback, not an exception", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect((await leadExtractionService.extract(input)).fallback).toBe(true);
  });

  it("unusable content still bills the call (OpenAI answered) but falls back to hints", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(openAiResponse("not json")));
    const result = await leadExtractionService.extract(input);
    expect(result.fallback).toBe(true);
    expect(result.usage).not.toBeNull();
  });

  it("without an API key it makes no request and falls back", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await leadExtractionService.extract(input);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ fallback: true, usage: null });
  });
});
