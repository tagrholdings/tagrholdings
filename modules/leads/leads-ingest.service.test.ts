import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./leads.repository", () => ({ leadsRepository: { findIdByDedupeKey: vi.fn(), createIfNew: vi.fn() } }));
vi.mock("@/modules/lead-extraction/lead-extraction.service", () => ({ leadExtractionService: { extract: vi.fn() } }));
vi.mock("@/modules/lead-engine/lead-engine.service", () => ({ leadEngineService: { recordUsage: vi.fn() } }));
vi.mock("@/lib/safe-fetch", () => ({ safeFetchText: vi.fn() }));

import { leadsIngestService } from "./leads-ingest.service";
import { leadsRepository } from "./leads.repository";
import { leadExtractionService } from "@/modules/lead-extraction/lead-extraction.service";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { safeFetchText } from "@/lib/safe-fetch";

const TENANT_A = "tenant-a";
const usage = { provider: "openai", operation: "extract", model: "gpt-4o-mini", inputTokens: 100, outputTokens: 20, costUsd: 0.0001 } as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(leadsRepository.findIdByDedupeKey).mockResolvedValue(undefined);
  vi.mocked(leadsRepository.createIfNew).mockResolvedValue({ id: "lead-1" });
  vi.mocked(leadExtractionService.extract).mockResolvedValue({ fields: { businessName: "Cool Air LLC", summary: "HVAC in Phoenix." }, usage, fallback: false });
  vi.mocked(leadEngineService.recordUsage).mockResolvedValue(undefined);
});

describe("ingestManual (POST /api/leads/ingest)", () => {
  const input = { sourceUrl: "https://bizsite.test/listing/42?utm_source=x", rawText: "Owner retiring.", note: "found manually, site blocks scraping" };

  it("saves a manual_assist lead, through the shared extraction, for the given tenant", async () => {
    const result = await leadsIngestService.ingestManual(TENANT_A, input);

    expect(result).toEqual({ id: "lead-1", duplicate: false, extractionFallback: false });
    expect(leadExtractionService.extract).toHaveBeenCalledTimes(1);
    expect(vi.mocked(leadExtractionService.extract).mock.calls[0][0]).toMatchObject({ sourceType: "manual_assist", hints: { website: input.sourceUrl } });
    // The submitter's note goes to the model as context…
    expect(vi.mocked(leadExtractionService.extract).mock.calls[0][0].text).toContain("found manually, site blocks scraping");

    expect(leadsRepository.createIfNew).toHaveBeenCalledWith(TENANT_A, {
      sourceType: "manual_assist",
      sourceUrl: input.sourceUrl,
      businessName: "Cool Air LLC",
      rawText: "Owner retiring.",
      // …and is kept on the lead.
      extractedFields: { businessName: "Cool Air LLC", summary: "HVAC in Phoenix.", note: "found manually, site blocks scraping" },
      dedupeKey: "url:https://bizsite.test/listing/42",
    });
  });

  it("logs the AI spend for that tenant", async () => {
    await leadsIngestService.ingestManual(TENANT_A, input);
    expect(leadEngineService.recordUsage).toHaveBeenCalledWith(TENANT_A, usage);
  });

  it("uses a supplied businessName over the AI's", async () => {
    await leadsIngestService.ingestManual(TENANT_A, { ...input, businessName: "My Name" });
    expect(vi.mocked(leadsRepository.createIfNew).mock.calls[0][1].businessName).toBe("My Name");
  });

  it("re-submitting the same URL is a no-op: same id, no AI call, no spend, no insert", async () => {
    vi.mocked(leadsRepository.findIdByDedupeKey).mockResolvedValue("lead-existing");
    const result = await leadsIngestService.ingestManual(TENANT_A, { ...input, sourceUrl: "https://www.bizsite.test/listing/42/" });
    expect(result).toEqual({ id: "lead-existing", duplicate: true, extractionFallback: false });
    expect(leadExtractionService.extract).not.toHaveBeenCalled();
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
    expect(leadEngineService.recordUsage).not.toHaveBeenCalled();
  });

  it("dedupes within the tenant only: the lookup is always scoped to the caller's tenant", async () => {
    await leadsIngestService.ingestManual("tenant-b", input);
    expect(leadsRepository.findIdByDedupeKey).toHaveBeenCalledWith("tenant-b", "manual_assist", expect.any(String));
  });

  it("an AI failure doesn't lose the lead: it's saved with the source's fields and flagged", async () => {
    vi.mocked(leadExtractionService.extract).mockResolvedValue({ fields: { businessName: "bizsite.test" }, usage: null, fallback: true });
    const result = await leadsIngestService.ingestManual(TENANT_A, input);
    expect(result.extractionFallback).toBe(true);
    expect(leadsRepository.createIfNew).toHaveBeenCalled();
    expect(leadEngineService.recordUsage).not.toHaveBeenCalled();
  });

  it("a failing usage log never blocks saving the lead", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(leadEngineService.recordUsage).mockRejectedValue(new Error("db down"));
    expect((await leadsIngestService.ingestManual(TENANT_A, input)).id).toBe("lead-1");
  });

  it("losing an insert race returns the winner as a duplicate", async () => {
    vi.mocked(leadsRepository.createIfNew).mockResolvedValue(undefined);
    vi.mocked(leadsRepository.findIdByDedupeKey).mockResolvedValueOnce(undefined).mockResolvedValueOnce("lead-winner");
    expect(await leadsIngestService.ingestManual(TENANT_A, input)).toMatchObject({ id: "lead-winner", duplicate: true });
  });
});

describe("quickAdd (Leads Inbox)", () => {
  it("pasted text: saved as manual_assist with the text as rawText; a link inside it is the sourceUrl", async () => {
    await leadsIngestService.quickAdd(TENANT_A, "HVAC co, owner retiring. Details: https://bizsite.test/l/9");
    expect(leadsRepository.createIfNew).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ sourceType: "manual_assist", sourceUrl: "https://bizsite.test/l/9", dedupeKey: "url:https://bizsite.test/l/9" })
    );
    expect(safeFetchText).not.toHaveBeenCalled();
  });

  it("pasted text with no link: sourceUrl null, deduped by a hash of the text (same text twice -> same key)", async () => {
    await leadsIngestService.quickAdd(TENANT_A, "Great plumbing business for sale");
    await leadsIngestService.quickAdd(TENANT_A, "great   plumbing business for SALE");
    const [first, second] = vi.mocked(leadsRepository.createIfNew).mock.calls.map((c) => c[1]);
    expect(first.sourceUrl).toBeNull();
    expect(first.dedupeKey).toMatch(/^text:[0-9a-f]{24}$/);
    expect(second.dedupeKey).toBe(first.dedupeKey);
  });

  it("a lone link: fetches the page, converts it to text and extracts from that", async () => {
    vi.mocked(safeFetchText).mockResolvedValue({ status: 200, finalUrl: "https://bizsite.test/l/9", contentType: "text/html; charset=utf-8", text: "<h1>HVAC for sale</h1><p>Asking $850,000</p>" });
    const result = await leadsIngestService.quickAdd(TENANT_A, "https://bizsite.test/l/9");
    expect(result).toMatchObject({ id: "lead-1", pageFetched: true, duplicate: false });
    expect(vi.mocked(leadExtractionService.extract).mock.calls[0][0].text).toContain("Asking $850,000");
  });

  it("a lone link that can't be read still saves the lead (URL only, no AI call) and says the page wasn't fetched", async () => {
    vi.mocked(safeFetchText).mockResolvedValue({ status: 403, finalUrl: "https://bizsite.test/l/9", contentType: "text/html", text: "Access denied" });
    const result = await leadsIngestService.quickAdd(TENANT_A, "https://bizsite.test/l/9");
    expect(result).toMatchObject({ pageFetched: false, extractionFallback: true });
    expect(leadExtractionService.extract).not.toHaveBeenCalled();
    const saved = vi.mocked(leadsRepository.createIfNew).mock.calls[0][1];
    expect(saved).toMatchObject({ sourceType: "manual_assist", sourceUrl: "https://bizsite.test/l/9", businessName: "bizsite.test" });
    expect(saved.extractedFields.note).toContain("paste its text");
  });

  it("a blocked/unreachable link (null from the SSRF-safe fetch) is handled the same way", async () => {
    vi.mocked(safeFetchText).mockResolvedValue(null);
    expect((await leadsIngestService.quickAdd(TENANT_A, "http://169.254.169.254/latest")).pageFetched).toBe(false);
  });

  it("a link that's already in the inbox is not fetched again", async () => {
    vi.mocked(leadsRepository.findIdByDedupeKey).mockResolvedValue("lead-existing");
    const result = await leadsIngestService.quickAdd(TENANT_A, "https://bizsite.test/l/9");
    expect(result).toMatchObject({ id: "lead-existing", duplicate: true });
    expect(safeFetchText).not.toHaveBeenCalled();
  });

  it("rejects empty input", async () => {
    await expect(leadsIngestService.quickAdd(TENANT_A, "   ")).rejects.toThrow("Paste a link");
  });
});
