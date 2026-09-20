import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./leads.repository", () => ({ leadsRepository: { findIdByDedupeKey: vi.fn(), createIfNew: vi.fn(), existsForEmail: vi.fn(), findIdByListingSignature: vi.fn() } }));
vi.mock("@/modules/lead-extraction/lead-extraction.service", () => ({ leadExtractionService: { extract: vi.fn(), extractListings: vi.fn() } }));
vi.mock("@/modules/lead-engine/lead-engine.service", () => ({ leadEngineService: { recordUsage: vi.fn() } }));
vi.mock("@/lib/safe-fetch", () => ({ safeFetchText: vi.fn() }));

import { leadsIngestService, listingSignature } from "./leads-ingest.service";
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

// ---------------------------------------------------------------------------------------------------------------------
// Inbound listing emails: one email -> one lead PER listing
// ---------------------------------------------------------------------------------------------------------------------

describe("ingestEmailListings", () => {
  const RESEND_USAGE = { provider: "resend", operation: "receive", requests: 1, costUsd: 0.0009 } as const;
  const email = {
    emailId: "re_abc123",
    from: "BizBuySell <alerts@bizbuysell.test>",
    subject: "New HVAC businesses for sale in Arizona",
    body: "1) HVAC company Phoenix - Asking $850,000 (https://bizbuysell.test/l/1)\n2) Plumbing route Mesa (https://bizbuysell.test/l/2)\n3) Heating & air Tucson (https://bizbuysell.test/l/3)",
    senderSite: "https://bizbuysell.test",
    extraUsage: [RESEND_USAGE],
  };
  const listing = (n: number, over: Record<string, unknown> = {}) => ({
    fields: { businessName: `Listing ${n}`, askingPrice: `$${n}00,000`, location: { city: "Phoenix", state: "AZ" }, estimatedRevenue: `$${n}M` },
    listingUrl: `https://bizbuysell.test/l/${n}` as string | null,
    ...over,
  });

  beforeEach(() => {
    vi.mocked(leadsRepository.existsForEmail).mockResolvedValue(false);
    vi.mocked(leadsRepository.findIdByListingSignature).mockResolvedValue(undefined);
    vi.mocked(leadsRepository.createIfNew).mockImplementation(async (_t, lead) => ({ id: `id:${lead.dedupeKey}` }));
    vi.mocked(leadExtractionService.extractListings).mockResolvedValue({ listings: [listing(1), listing(2), listing(3)], usage, fallback: false });
  });

  it("creates one lead per listing, each pointing at its own link, from ONE AI call", async () => {
    const result = await leadsIngestService.ingestEmailListings(TENANT_A, email);

    expect(leadExtractionService.extractListings).toHaveBeenCalledTimes(1);
    expect(vi.mocked(leadExtractionService.extractListings).mock.calls[0][0].text).toContain(`Subject: ${email.subject}`);
    const saved = vi.mocked(leadsRepository.createIfNew).mock.calls.map(([tenant, lead]) => ({ tenant, ...lead }));
    expect(saved.map((l) => l.tenant)).toEqual([TENANT_A, TENANT_A, TENANT_A]);
    expect(saved.map((l) => l.dedupeKey)).toEqual(["email:re_abc123:0", "email:re_abc123:1", "email:re_abc123:2"]);
    expect(saved.map((l) => l.sourceUrl)).toEqual(["https://bizbuysell.test/l/1", "https://bizbuysell.test/l/2", "https://bizbuysell.test/l/3"]);
    expect(saved.map((l) => l.businessName)).toEqual(["Listing 1", "Listing 2", "Listing 3"]);
    expect(saved.every((l) => l.sourceType === "email_digest")).toBe(true);
    expect(result).toMatchObject({ listingsFound: 3, alreadyKnown: 0, redelivery: false, extractionFallback: false });
    expect(result.leadIds).toHaveLength(3);
  });

  it("stores the whole email once (on the first listing); the others point back at it", async () => {
    await leadsIngestService.ingestEmailListings(TENANT_A, email);
    const [first, second] = vi.mocked(leadsRepository.createIfNew).mock.calls.map(([, lead]) => lead);
    expect(first.rawText).toContain("Plumbing route Mesa"); // the full body
    expect(second.rawText).toContain("Listing 2 of 3");
    expect(second.rawText).not.toContain("Heating & air Tucson");
  });

  it("logs the AI call and the inbound email ONCE each, however many listings", async () => {
    await leadsIngestService.ingestEmailListings(TENANT_A, email);
    expect(leadEngineService.recordUsage).toHaveBeenCalledTimes(2);
    expect(leadEngineService.recordUsage).toHaveBeenCalledWith(TENANT_A, usage);
    expect(leadEngineService.recordUsage).toHaveBeenCalledWith(TENANT_A, RESEND_USAGE);
  });

  it("remembers each listing's signature so the same one in a later digest is recognised", async () => {
    await leadsIngestService.ingestEmailListings(TENANT_A, email);
    const [first] = vi.mocked(leadsRepository.createIfNew).mock.calls.map(([, lead]) => lead);
    expect(first.extractedFields.listingSignature).toBe(listingSignature(listing(1).fields, listing(1).listingUrl));
  });

  it("skips a listing an earlier digest already brought, but keeps the others (indexes stay stable)", async () => {
    const secondSignature = listingSignature(listing(2).fields, listing(2).listingUrl)!;
    vi.mocked(leadsRepository.findIdByListingSignature).mockImplementation(async (_t, sig) => (sig === secondSignature ? "old-lead" : undefined));

    const result = await leadsIngestService.ingestEmailListings(TENANT_A, email);
    expect(result).toMatchObject({ listingsFound: 3, alreadyKnown: 1 });
    expect(vi.mocked(leadsRepository.createIfNew).mock.calls.map(([, lead]) => lead.dedupeKey)).toEqual(["email:re_abc123:0", "email:re_abc123:2"]);
  });

  it("a redelivered webhook is recognised before any AI call: nothing extracted, nothing paid, nothing created", async () => {
    vi.mocked(leadsRepository.existsForEmail).mockResolvedValue(true);
    const result = await leadsIngestService.ingestEmailListings(TENANT_A, email);
    expect(result).toMatchObject({ redelivery: true, leadIds: [] });
    expect(leadExtractionService.extractListings).not.toHaveBeenCalled();
    expect(leadEngineService.recordUsage).not.toHaveBeenCalled();
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
  });

  it("the redelivery check is scoped to the tenant", async () => {
    await leadsIngestService.ingestEmailListings("tenant-b", email);
    expect(leadsRepository.existsForEmail).toHaveBeenCalledWith("tenant-b", "re_abc123");
    expect(leadsRepository.findIdByListingSignature).toHaveBeenCalledWith("tenant-b", expect.any(String));
  });

  it("a listing with no link falls back to the sender's site; one with no title gets a numbered name from the subject", async () => {
    vi.mocked(leadExtractionService.extractListings).mockResolvedValue({
      listings: [{ fields: { askingPrice: "$1M" }, listingUrl: "https://bizbuysell.test/l/9" }, { fields: { businessName: "No link here" }, listingUrl: null }],
      usage,
      fallback: false,
    });
    await leadsIngestService.ingestEmailListings(TENANT_A, email);
    const [first, second] = vi.mocked(leadsRepository.createIfNew).mock.calls.map(([, lead]) => lead);
    expect(first.businessName).toBe("New HVAC businesses for sale in Arizona (#1)");
    expect(second.sourceUrl).toBe("https://bizbuysell.test");
  });

  it("an email the AI ran on but found no business for sale in is kept as ONE plain lead saying so", async () => {
    vi.mocked(leadExtractionService.extractListings).mockResolvedValue({ listings: [], usage, fallback: false });
    const result = await leadsIngestService.ingestEmailListings(TENANT_A, { ...email, subject: "Welcome to BizBuySell alerts" });
    const [lead] = vi.mocked(leadsRepository.createIfNew).mock.calls.map(([, l]) => l);
    expect(vi.mocked(leadsRepository.createIfNew)).toHaveBeenCalledTimes(1);
    expect(lead).toMatchObject({ dedupeKey: "email:re_abc123", businessName: "Welcome to BizBuySell alerts" });
    expect(lead.extractedFields.summary).toContain("No business for sale was recognised");
    expect(result).toMatchObject({ listingsFound: 0, extractionFallback: false });
    expect(leadEngineService.recordUsage).toHaveBeenCalledWith(TENANT_A, usage); // the AI call happened, so it is billed
  });

  it("if the AI step fails the email is still kept (one plain lead, flagged) and only the inbound email is billed", async () => {
    vi.mocked(leadExtractionService.extractListings).mockResolvedValue({ listings: [], usage: null, fallback: true });
    const result = await leadsIngestService.ingestEmailListings(TENANT_A, email);
    const [lead] = vi.mocked(leadsRepository.createIfNew).mock.calls.map(([, l]) => l);
    expect(lead.extractedFields.note).toBe("Automatic extraction failed for this email.");
    expect(result.extractionFallback).toBe(true);
    expect(leadEngineService.recordUsage).toHaveBeenCalledTimes(1);
    expect(leadEngineService.recordUsage).toHaveBeenCalledWith(TENANT_A, RESEND_USAGE);
  });

  it("a failing usage log never blocks saving the leads", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(leadEngineService.recordUsage).mockRejectedValue(new Error("db down"));
    expect((await leadsIngestService.ingestEmailListings(TENANT_A, email)).leadIds).toHaveLength(3);
  });
});

describe("listingSignature", () => {
  const base = { businessName: "Profitable HVAC Co", location: { city: "Phoenix", state: "AZ" }, askingPrice: "$850,000" };

  it("is the same for the same listing however it is cased or spaced", () => {
    expect(listingSignature(base, null)).toBe(listingSignature({ ...base, businessName: "  profitable hvac co ", askingPrice: "$850,000 " }, "https://x.test/other-link"));
  });

  it("differs when the asking price or the place differs (a different listing)", () => {
    expect(listingSignature({ ...base, askingPrice: "$900,000" }, null)).not.toBe(listingSignature(base, null));
    expect(listingSignature({ ...base, location: { city: "Mesa", state: "AZ" } }, null)).not.toBe(listingSignature(base, null));
  });

  it("falls back to the normalised link when there is no title, and to null when there is nothing to go on", () => {
    expect(listingSignature({}, "https://www.x.test/l/1/?utm_source=a")).toBe(listingSignature({}, "https://x.test/l/1"));
    expect(listingSignature({}, null)).toBeNull();
    expect(listingSignature({}, "not a url")).toBeNull();
  });
});
