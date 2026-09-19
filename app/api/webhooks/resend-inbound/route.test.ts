import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Real signature verification (the Resend SDK's Svix check) — only the network call for the body is faked.
vi.mock("@/lib/resend-inbound", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/resend-inbound")>()),
  fetchReceivedEmail: vi.fn(),
}));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { tenantExists: vi.fn() } }));
// The lead-saving path runs for real (email-inbound -> ingest service); only its edges are faked.
vi.mock("@/modules/leads/leads.repository", () => ({ leadsRepository: { findIdByDedupeKey: vi.fn(), createIfNew: vi.fn(), existsForEmail: vi.fn(), findIdByListingSignature: vi.fn() } }));
vi.mock("@/modules/lead-extraction/lead-extraction.service", async (importActual) => ({
  ...(await importActual<typeof import("@/modules/lead-extraction/lead-extraction.service")>()),
  leadExtractionService: { extract: vi.fn(), extractListings: vi.fn() },
}));
vi.mock("@/modules/lead-engine/lead-engine.service", () => ({ leadEngineService: { recordUsage: vi.fn() } }));
vi.mock("@/modules/email-sources/email-sources.service", () => ({
  emailSourcesService: { listAwaitingConfirmation: vi.fn(), markSubscribedFromConfirmation: vi.fn(), noteConfirmationProblem: vi.fn() },
}));
vi.mock("@/lib/safe-fetch", () => ({ safeFetchText: vi.fn() }));

import { POST } from "./route";
import { fetchReceivedEmail } from "@/lib/resend-inbound";
import { safeFetchText } from "@/lib/safe-fetch";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { leadsRepository } from "@/modules/leads/leads.repository";
import { leadExtractionService } from "@/modules/lead-extraction/lead-extraction.service";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { emailSourcesService } from "@/modules/email-sources/email-sources.service";

const SECRET_BYTES = Buffer.from("resend-webhook-test-secret-bytes");
const SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;
const TENANT = "3f8a1c2e-6b1d-4c7a-9a52-0d3c5f1e7b90";
const EMAIL_ID = "re_email_123";
const OPENAI_USAGE = { provider: "openai", operation: "extract", model: "gpt-4o-mini", inputTokens: 900, outputTokens: 120, costUsd: 0.0002 } as const;

/** A webhook request signed exactly the way Svix/Resend signs it. */
function signedRequest(payload: object, opts: { secretBytes?: Buffer; timestamp?: number; tamper?: boolean } = {}) {
  const body = JSON.stringify(payload);
  const id = "msg_test_1";
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", opts.secretBytes ?? SECRET_BYTES).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Request("https://crm.test/api/webhooks/resend-inbound", {
    method: "POST",
    headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` },
    body: opts.tamper ? body.replace("email.received", "email.received ") : body,
  });
}

const receivedEvent = { type: "email.received", created_at: new Date().toISOString(), data: { email_id: EMAIL_ID, from: "x", to: ["leads@tagrholdings.com"], subject: "s" } };

const listingEmail = {
  id: EMAIL_ID,
  from: "Listings <alerts@bizlistings.test>",
  to: ["leads@tagrholdings.com"],
  subject: "3 new HVAC businesses for sale in Arizona",
  text: "Profitable HVAC company, Phoenix AZ. Asking $850,000. Owner retiring. https://bizlistings.test/listing/42",
  html: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("INBOUND_EMAIL_TENANT_ID", TENANT);
  vi.mocked(tenancyService.tenantExists).mockResolvedValue(true);
  vi.mocked(fetchReceivedEmail).mockResolvedValue(listingEmail);
  vi.mocked(leadsRepository.findIdByDedupeKey).mockResolvedValue(undefined);
  vi.mocked(leadsRepository.existsForEmail).mockResolvedValue(false);
  vi.mocked(leadsRepository.findIdByListingSignature).mockResolvedValue(undefined);
  vi.mocked(leadsRepository.createIfNew).mockResolvedValue({ id: "lead-1" });
  vi.mocked(leadExtractionService.extractListings).mockResolvedValue({
    listings: [{ fields: { businessName: "Profitable HVAC company", askingPrice: "$850,000", location: { city: "Phoenix", state: "AZ" } }, listingUrl: "https://bizlistings.test/listing/42" }],
    usage: OPENAI_USAGE,
    fallback: false,
  });
  vi.mocked(leadEngineService.recordUsage).mockResolvedValue(undefined);
  vi.mocked(emailSourcesService.listAwaitingConfirmation).mockResolvedValue([]);
});

describe("resend-inbound webhook — signature", () => {
  it("rejects a request signed with the wrong secret", async () => {
    const res = await POST(signedRequest(receivedEvent, { secretBytes: Buffer.from("some-other-secret-bytes-000000") }));
    expect(res.status).toBe(401);
    expect(fetchReceivedEmail).not.toHaveBeenCalled();
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
  });

  it("rejects a body that was altered after signing", async () => {
    expect((await POST(signedRequest(receivedEvent, { tamper: true }))).status).toBe(401);
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
  });

  it("rejects a request with no Svix headers", async () => {
    const res = await POST(new Request("https://crm.test/x", { method: "POST", body: JSON.stringify(receivedEvent) }));
    expect(res.status).toBe(401);
  });

  it("rejects a replayed request (old timestamp)", async () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 10 * 60;
    expect((await POST(signedRequest(receivedEvent, { timestamp: tenMinutesAgo }))).status).toBe(401);
  });

  it("answers 500 (so Resend retries) when the webhook secret isn't configured — never processes unverified mail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    expect((await POST(signedRequest(receivedEvent))).status).toBe(500);
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
  });
});

describe("resend-inbound webhook — a valid email.received", () => {
  it("fetches the full body, extracts its listings, and saves each as an email_digest lead", async () => {
    const res = await POST(signedRequest(receivedEvent));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, outcome: "lead" });

    expect(fetchReceivedEmail).toHaveBeenCalledWith(EMAIL_ID); // the webhook itself is metadata-only
    expect(leadExtractionService.extractListings).toHaveBeenCalledTimes(1);
    expect(vi.mocked(leadExtractionService.extractListings).mock.calls[0][0]).toMatchObject({ sourceType: "email_digest" });
    expect(vi.mocked(leadExtractionService.extractListings).mock.calls[0][0].text).toContain("Owner retiring");

    expect(leadsRepository.createIfNew).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        sourceType: "email_digest",
        sourceUrl: "https://bizlistings.test/listing/42", // the listing's own link, not just the sender's site
        dedupeKey: `email:${EMAIL_ID}:0`,
        businessName: "Profitable HVAC company",
      })
    );
    expect(vi.mocked(leadsRepository.createIfNew).mock.calls[0][1].rawText).toContain("Subject: 3 new HVAC businesses for sale in Arizona");
  });

  it("logs the AI call and the inbound email as separate tracked services", async () => {
    await POST(signedRequest(receivedEvent));
    const providers = vi.mocked(leadEngineService.recordUsage).mock.calls.map(([, event]) => `${event.provider}/${event.operation}`);
    expect(providers.sort()).toEqual(["openai/extract", "resend/receive"]);
    for (const [tenant] of vi.mocked(leadEngineService.recordUsage).mock.calls) expect(tenant).toBe(TENANT);
  });

  it("a digest with several listings becomes one lead per listing, from ONE AI call", async () => {
    const listing = (n: number) => ({
      fields: { businessName: `HVAC company #${n}`, askingPrice: `$${n}00,000`, location: { city: "Phoenix", state: "AZ" } },
      listingUrl: `https://bizlistings.test/listing/${n}`,
    });
    vi.mocked(leadExtractionService.extractListings).mockResolvedValue({ listings: [listing(1), listing(2), listing(3)], usage: OPENAI_USAGE, fallback: false });
    vi.mocked(leadsRepository.createIfNew).mockImplementation(async (_t, lead) => ({ id: `id-${lead.dedupeKey}` }));

    const res = await POST(signedRequest(receivedEvent));
    expect(await res.json()).toEqual({ received: true, outcome: "lead" });

    expect(leadExtractionService.extractListings).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(leadsRepository.createIfNew).mock.calls.map(([, lead]) => lead);
    expect(saved.map((l) => l.dedupeKey)).toEqual([`email:${EMAIL_ID}:0`, `email:${EMAIL_ID}:1`, `email:${EMAIL_ID}:2`]);
    expect(saved.map((l) => l.sourceUrl)).toEqual([1, 2, 3].map((n) => `https://bizlistings.test/listing/${n}`));
    expect(saved.map((l) => l.businessName)).toEqual(["HVAC company #1", "HVAC company #2", "HVAC company #3"]);
    // Paid for once per email, however many listings it held.
    const providers = vi.mocked(leadEngineService.recordUsage).mock.calls.map(([, event]) => `${event.provider}/${event.operation}`);
    expect(providers.sort()).toEqual(["openai/extract", "resend/receive"]);
  });

  it("is idempotent: a redelivered webhook for the same email creates nothing and pays for nothing", async () => {
    vi.mocked(leadsRepository.existsForEmail).mockResolvedValue(true);
    const res = await POST(signedRequest(receivedEvent));
    expect(await res.json()).toEqual({ received: true, outcome: "lead" });
    expect(leadExtractionService.extractListings).not.toHaveBeenCalled();
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
    expect(leadEngineService.recordUsage).not.toHaveBeenCalled();
  });

  it("acknowledges and ignores other event types", async () => {
    const res = await POST(signedRequest({ type: "email.delivered", created_at: "x", data: { email_id: "e" } }));
    expect(await res.json()).toEqual({ ignored: true });
    expect(fetchReceivedEmail).not.toHaveBeenCalled();
  });

  it("uses the configured tenant, cross-checked against a real one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(tenancyService.tenantExists).mockResolvedValue(false);
    expect((await POST(signedRequest(receivedEvent))).status).toBe(500);
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
  });

  it("answers 500 (retry) when Resend's API can't return the body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetchReceivedEmail).mockRejectedValue(new Error("network down"));
    expect((await POST(signedRequest(receivedEvent))).status).toBe(500);
  });
});

describe("resend-inbound webhook — subscription confirmations", () => {
  const confirmEmail = {
    id: EMAIL_ID,
    from: "BizListings <no-reply@bizlistings.test>",
    to: ["leads@tagrholdings.com"],
    subject: "Please confirm your subscription",
    text: "Thanks for signing up. Confirm your email: https://bizlistings.test/confirm?t=abc123",
    html: null,
  };
  const source = { id: "src-1", signupUrl: "https://www.bizlistings.test/newsletter" };

  it("clicks the link, marks the matched source subscribed, and creates NO lead", async () => {
    vi.mocked(fetchReceivedEmail).mockResolvedValue(confirmEmail);
    vi.mocked(emailSourcesService.listAwaitingConfirmation).mockResolvedValue([source as never]);
    vi.mocked(safeFetchText).mockResolvedValue({ status: 200, finalUrl: "https://bizlistings.test/confirmed", contentType: "text/html", text: "ok" });

    const res = await POST(signedRequest(receivedEvent));
    expect(await res.json()).toEqual({ received: true, outcome: "subscription_confirmed" });
    expect(safeFetchText).toHaveBeenCalledWith("https://bizlistings.test/confirm?t=abc123", expect.anything());
    expect(emailSourcesService.markSubscribedFromConfirmation).toHaveBeenCalledWith(TENANT, "src-1");
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
    expect(leadExtractionService.extractListings).not.toHaveBeenCalled();
  });

  it("looks like a confirmation but matches no listed site -> falls through to normal extraction", async () => {
    vi.mocked(fetchReceivedEmail).mockResolvedValue(confirmEmail);
    vi.mocked(emailSourcesService.listAwaitingConfirmation).mockResolvedValue([{ id: "src-2", signupUrl: "https://othersite.test/join" } as never]);

    const res = await POST(signedRequest(receivedEvent));
    expect((await res.json()).outcome).toBe("lead");
    expect(safeFetchText).not.toHaveBeenCalled();
    expect(emailSourcesService.markSubscribedFromConfirmation).not.toHaveBeenCalled();
    expect(leadExtractionService.extractListings).toHaveBeenCalledTimes(1);
    expect(leadsRepository.createIfNew).toHaveBeenCalledWith(TENANT, expect.objectContaining({ sourceType: "email_digest" }));
  });

  it("matched, but the link can't be opened -> source left unsubscribed, a note is left, no lead", async () => {
    vi.mocked(fetchReceivedEmail).mockResolvedValue(confirmEmail);
    vi.mocked(emailSourcesService.listAwaitingConfirmation).mockResolvedValue([source as never]);
    vi.mocked(safeFetchText).mockResolvedValue({ status: 403, finalUrl: "x", contentType: "text/html", text: "" });

    const res = await POST(signedRequest(receivedEvent));
    expect((await res.json()).outcome).toBe("confirmation_failed");
    expect(emailSourcesService.markSubscribedFromConfirmation).not.toHaveBeenCalled();
    expect(emailSourcesService.noteConfirmationProblem).toHaveBeenCalledWith(TENANT, "src-1", expect.stringContaining("403"));
    expect(leadsRepository.createIfNew).not.toHaveBeenCalled();
  });
});
