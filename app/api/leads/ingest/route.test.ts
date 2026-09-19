import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/rate-limit/rate-limit.service", () => ({ rateLimitService: { isLimited: vi.fn() } }));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { tenantExists: vi.fn() } }));
vi.mock("@/modules/leads/leads-ingest.service", () => ({ leadsIngestService: { ingestManual: vi.fn() } }));

import { POST } from "./route";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { leadsIngestService } from "@/modules/leads/leads-ingest.service";

const KEY = "test-ingest-key-123";
const TENANT = "3f8a1c2e-6b1d-4c7a-9a52-0d3c5f1e7b90";
const LEAD_ID = "9b2f6a10-1c3d-4e5f-8a7b-2c4d6e8f0a1b";

function request(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${KEY}` }) {
  return new Request("https://crm.test/api/leads/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = { tenantId: TENANT, sourceUrl: "https://bizsite.test/listing/42", rawText: "Established HVAC company, owner retiring." };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("LEAD_INGEST_API_KEY", KEY);
  vi.mocked(rateLimitService.isLimited).mockResolvedValue(false);
  vi.mocked(tenancyService.tenantExists).mockResolvedValue(true);
  vi.mocked(leadsIngestService.ingestManual).mockResolvedValue({ id: LEAD_ID, duplicate: false, extractionFallback: false });
});

describe("POST /api/leads/ingest — auth", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await POST(request(validBody, {}));
    expect(res.status).toBe(401);
    expect(leadsIngestService.ingestManual).not.toHaveBeenCalled();
  });

  it("rejects a wrong key", async () => {
    const res = await POST(request(validBody, { authorization: "Bearer not-the-key" }));
    expect(res.status).toBe(401);
    expect(leadsIngestService.ingestManual).not.toHaveBeenCalled();
  });

  it("rejects a key of the right length but wrong value, and a non-Bearer scheme", async () => {
    expect((await POST(request(validBody, { authorization: `Bearer ${"x".repeat(KEY.length)}` }))).status).toBe(401);
    expect((await POST(request(validBody, { authorization: `Basic ${KEY}` }))).status).toBe(401);
  });

  it("is disabled (401 for everyone) when LEAD_INGEST_API_KEY isn't configured", async () => {
    vi.stubEnv("LEAD_INGEST_API_KEY", "");
    expect((await POST(request(validBody))).status).toBe(401);
  });

  it("doesn't touch the rate limiter for unauthenticated calls", async () => {
    await POST(request(validBody, {}));
    expect(rateLimitService.isLimited).not.toHaveBeenCalled();
  });
});

describe("POST /api/leads/ingest — validation", () => {
  it.each([
    ["missing rawText", { tenantId: TENANT, sourceUrl: "https://x.test/a" }],
    ["missing sourceUrl", { tenantId: TENANT, rawText: "text" }],
    ["missing tenantId (there is no default)", { sourceUrl: "https://x.test/a", rawText: "text" }],
    ["tenantId that isn't a uuid", { ...validBody, tenantId: "tagr" }],
    ["sourceUrl that isn't http(s)", { ...validBody, sourceUrl: "javascript:alert(1)" }],
    ["blank rawText", { ...validBody, rawText: "   " }],
  ])("400s on %s", async (_label, body) => {
    const res = await POST(request(body));
    expect(res.status).toBe(400);
    expect(leadsIngestService.ingestManual).not.toHaveBeenCalled();
  });

  it("400s on a body that isn't JSON", async () => {
    expect((await POST(request("not json"))).status).toBe(400);
  });

  it("400s when tenantId isn't a real tenant", async () => {
    vi.mocked(tenancyService.tenantExists).mockResolvedValue(false);
    const res = await POST(request(validBody));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown tenantId." });
    expect(leadsIngestService.ingestManual).not.toHaveBeenCalled();
  });
});

describe("POST /api/leads/ingest — success", () => {
  it("creates the lead through the shared ingestion service and returns its id", async () => {
    const res = await POST(request({ ...validBody, businessName: "Cool Air", note: "found manually, site blocks scraping" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: LEAD_ID, duplicate: false, extractionFallback: false });
    expect(tenancyService.tenantExists).toHaveBeenCalledWith(TENANT);
    expect(leadsIngestService.ingestManual).toHaveBeenCalledWith(TENANT, {
      sourceUrl: validBody.sourceUrl,
      rawText: validBody.rawText,
      businessName: "Cool Air",
      note: "found manually, site blocks scraping",
    });
  });

  it("answers 200 with duplicate: true when the lead already exists", async () => {
    vi.mocked(leadsIngestService.ingestManual).mockResolvedValue({ id: LEAD_ID, duplicate: true, extractionFallback: false });
    const res = await POST(request(validBody));
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
  });

  it("500s without leaking details when saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(leadsIngestService.ingestManual).mockRejectedValue(new Error('duplicate key value violates unique constraint "raw_leads_pkey"'));
    const res = await POST(request(validBody));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("raw_leads");
  });
});

describe("POST /api/leads/ingest — rate limit", () => {
  it("uses ~20 requests a minute", async () => {
    await POST(request(validBody));
    expect(rateLimitService.isLimited).toHaveBeenCalledWith("leads-ingest", 20, 60_000);
  });

  it("answers 429 once the limit is crossed and doesn't ingest", async () => {
    vi.mocked(rateLimitService.isLimited).mockResolvedValue(true);
    const res = await POST(request(validBody));
    expect(res.status).toBe(429);
    expect(leadsIngestService.ingestManual).not.toHaveBeenCalled();
  });
});
