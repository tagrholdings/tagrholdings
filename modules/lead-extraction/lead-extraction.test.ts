import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import golden from "../../scraper/tests/fixtures/extraction_golden.json";
import spec from "../../scraper/src/leadengine/shared/lead-engine-spec.json";
import { leadExtractionService, openAiCostUsd, parseListings, toExtractedFields } from "./lead-extraction.service";

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

// ---------------------------------------------------------------------------------------------------------------------
// Listing digests: several businesses for sale in one email
// ---------------------------------------------------------------------------------------------------------------------

describe("listings extraction contract (shared spec)", () => {
  const item = spec.listingsExtraction.outputSchema.properties.listings.items;

  it("is valid for OpenAI strict mode: every property required, none extra, every level closed", () => {
    expect(spec.listingsExtraction.outputSchema.additionalProperties).toBe(false);
    expect(spec.listingsExtraction.outputSchema.required).toEqual(["listings"]);
    expect(item.additionalProperties).toBe(false);
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
  });

  it("each listing carries every field toExtractedFields reads from a single-business extraction, plus its link", () => {
    const single = Object.keys(spec.extraction.outputSchema.properties);
    const listing = Object.keys(item.properties);
    expect(listing).toContain("listing_url");
    // Fields a listing email legitimately has no equivalent of (a listing has no website of its own; the address is hidden).
    const notInListings = ["address", "website"];
    for (const key of single.filter((k) => !notInListings.includes(k))) expect(listing).toContain(key);
  });
});

describe("parseListings", () => {
  const text = "1) HVAC company (https://bizbuysell.test/l/1) 2) Plumbing (https://bizbuysell.test/l/2)";
  const entry = (over: Record<string, unknown> = {}) => ({ business_name: "HVAC company", listing_url: "https://bizbuysell.test/l/1", asking_price_usd: 850000, signals: ["retiring"], ...over });

  it("maps each entry through the same field mapping as a single business (numbers included)", () => {
    const [listing] = parseListings({ listings: [entry()] }, text);
    expect(listing.fields).toMatchObject({ businessName: "HVAC company", askingPriceUsd: 850000, signals: ["retiring"] });
    expect(listing.listingUrl).toBe("https://bizbuysell.test/l/1");
  });

  it("only trusts a link that literally appears in the email text (the model can't hand us a URL it made up)", () => {
    const [listing] = parseListings({ listings: [entry({ listing_url: "https://evil.test/made-up" })] }, text);
    expect(listing.listingUrl).toBeNull();
    expect(listing.fields.businessName).toBe("HVAC company"); // the listing itself is kept
  });

  it("never accepts a non-http(s) link, even if it appears in the text", () => {
    const withJs = `${text} javascript:alert(1)`;
    expect(parseListings({ listings: [entry({ listing_url: "javascript:alert(1)" })] }, withJs)[0].listingUrl).toBeNull();
  });

  it("drops an entry that has neither a title nor a usable link", () => {
    expect(parseListings({ listings: [entry({ business_name: null, listing_url: null }), entry({ business_name: "  ", listing_url: "https://evil.test/x" })] }, text)).toEqual([]);
  });

  it("keeps an entry that has only a link", () => {
    const [listing] = parseListings({ listings: [entry({ business_name: null })] }, text);
    expect(listing.fields.businessName).toBeNull();
    expect(listing.listingUrl).toBe("https://bizbuysell.test/l/1");
  });

  it(`caps at ${spec.listingsExtraction.maxListings} listings, in order`, () => {
    const many = Array.from({ length: 30 }, (_, i) => entry({ business_name: `L${i}`, listing_url: null }));
    const listings = parseListings({ listings: many }, text);
    expect(listings).toHaveLength(spec.listingsExtraction.maxListings);
    expect(listings[0].fields.businessName).toBe("L0");
  });

  it("tolerates junk: no listings key, a non-array, non-object entries", () => {
    expect(parseListings({}, text)).toEqual([]);
    expect(parseListings({ listings: "nope" }, text)).toEqual([]);
    expect(parseListings({ listings: [null, 5, "x", [], entry()] }, text)).toHaveLength(1);
  });
});

describe("leadExtractionService.extractListings", () => {
  const emailText = "From: alerts\nSubject: New HVAC listings\n\nHVAC company Phoenix asking $850,000 (https://bizbuysell.test/l/1)";

  function openAiResponse(content: string, status = 200) {
    return new Response(JSON.stringify({ model: "gpt-4o-mini-2024-07-18", usage: { prompt_tokens: 3000, completion_tokens: 600 }, choices: [{ message: { content } }] }), { status });
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

  it("sends the LISTINGS prompt with the strict digest schema and a larger output budget, and prices the call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse(JSON.stringify({ listings: [{ business_name: "HVAC company Phoenix", listing_url: "https://bizbuysell.test/l/1", asking_price_usd: 850000, signals: [] }] })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await leadExtractionService.extractListings({ text: emailText, sourceType: "email_digest" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toBe(spec.listingsExtraction.systemPrompt);
    expect(body.messages[1].content).toContain("BEGIN EMAIL TEXT");
    expect(body.response_format.json_schema).toMatchObject({ name: "listing_digest_extraction", strict: true });
    expect(body.max_completion_tokens).toBe(spec.listingsExtraction.maxOutputTokens);

    expect(result.fallback).toBe(false);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].listingUrl).toBe("https://bizbuysell.test/l/1");
    // 3000 * 0.15/1M + 600 * 0.60/1M
    expect(result.usage!.costUsd).toBeCloseTo(0.00081, 8);
  });

  it("a digest with no business for sale is a successful, billed extraction with an empty list (not a failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(openAiResponse(JSON.stringify({ listings: [] }))));
    const result = await leadExtractionService.extractListings({ text: emailText, sourceType: "email_digest" });
    expect(result).toMatchObject({ listings: [], fallback: false });
    expect(result.usage).not.toBeNull();
  });

  it("unusable output is a fallback that is still billed; an HTTP error or a network failure is a fallback that is not", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(openAiResponse("not json")));
    expect(await leadExtractionService.extractListings({ text: emailText, sourceType: "email_digest" })).toMatchObject({ fallback: true, listings: [], usage: expect.anything() });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    expect(await leadExtractionService.extractListings({ text: emailText, sourceType: "email_digest" })).toMatchObject({ fallback: true, usage: null });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await leadExtractionService.extractListings({ text: emailText, sourceType: "email_digest" })).toMatchObject({ fallback: true, usage: null });
  });

  it("without an API key it makes no request and reports a fallback", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await leadExtractionService.extractListings({ text: emailText, sourceType: "email_digest" })).toMatchObject({ fallback: true, usage: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only sends the first part of a very long digest", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse(JSON.stringify({ listings: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await leadExtractionService.extractListings({ text: "y".repeat(200_000), sourceType: "email_digest" });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content as string;
    expect(sent.length).toBeLessThan(spec.listingsExtraction.maxInputChars + 300);
  });
});
