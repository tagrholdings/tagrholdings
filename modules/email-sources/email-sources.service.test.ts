import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./email-sources.repository", () => ({
  emailSourcesRepository: { findById: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn(), findAllForTenant: vi.fn(), findAwaitingConfirmation: vi.fn() },
}));
vi.mock("@/lib/github-dispatch", () => ({ dispatchLeadEngineWorkflow: vi.fn() }));

import { emailSourcesService } from "./email-sources.service";
import { emailSourcesRepository } from "./email-sources.repository";
import { dispatchLeadEngineWorkflow } from "@/lib/github-dispatch";
import { emailSourceState, signupHandoffReason } from "./email-sources.types";

const base = {
  id: "s1", siteName: "BizListings", signupUrl: "https://bizlistings.test/join", emailFieldSelector: "#email", submitSelector: "button[type=submit]",
  subscribed: false, captchaProtected: false, notes: null, source: "manual", subscribedAt: null, attemptRequestedAt: null, lastAttemptAt: null, lastAttemptResult: null, lastAttemptError: null, createdAt: new Date(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(emailSourcesRepository.findById).mockResolvedValue(base as never);
  vi.mocked(emailSourcesRepository.update).mockResolvedValue({ ...base, attemptRequestedAt: new Date() } as never);
  vi.mocked(dispatchLeadEngineWorkflow).mockResolvedValue("dispatched");
});

describe("requestAttempt", () => {
  it("queues the attempt in the database and asks GitHub to start the run", async () => {
    const result = await emailSourcesService.requestAttempt("t1", "s1");
    expect(emailSourcesRepository.update).toHaveBeenCalledWith("t1", "s1", { attemptRequestedAt: expect.any(Date) });
    expect(dispatchLeadEngineWorkflow).toHaveBeenCalledWith({ task: "email-signups" });
    expect(result.dispatch).toBe("dispatched");
  });

  it("still succeeds (queued for the scheduled run) when GitHub isn't configured", async () => {
    vi.mocked(dispatchLeadEngineWorkflow).mockResolvedValue("not_configured");
    expect((await emailSourcesService.requestAttempt("t1", "s1")).dispatch).toBe("not_configured");
    expect(emailSourcesRepository.update).toHaveBeenCalled();
  });

  it.each([
    ["a source from another tenant / unknown id", undefined, "not found"],
    ["an already-subscribed source", { ...base, subscribed: true }, "Already subscribed"],
    ["a captcha-protected site", { ...base, captchaProtected: true }, "captcha"],
    ["a source whose last attempt hit a captcha", { ...base, lastAttemptResult: "captcha" }, "captcha"],
    ["a source with no selectors configured", { ...base, emailFieldSelector: null }, "selectors"],
  ])("refuses %s", async (_label, source, message) => {
    vi.mocked(emailSourcesRepository.findById).mockResolvedValue(source as never);
    await expect(emailSourcesService.requestAttempt("t1", "s1")).rejects.toThrow(new RegExp(message, "i"));
    expect(emailSourcesRepository.update).not.toHaveBeenCalled();
    expect(dispatchLeadEngineWorkflow).not.toHaveBeenCalled();
  });
});

describe("tenant isolation", () => {
  it("every read/write is scoped by the tenant id it was called with", async () => {
    await emailSourcesService.requestAttempt("tenant-b", "s1");
    expect(emailSourcesRepository.findById).toHaveBeenCalledWith("tenant-b", "s1");
    expect(emailSourcesRepository.update).toHaveBeenCalledWith("tenant-b", "s1", expect.anything());
  });

  it("removing something that isn't this tenant's reads as not found", async () => {
    vi.mocked(emailSourcesRepository.findById).mockResolvedValue(undefined);
    await expect(emailSourcesService.remove("tenant-b", "s1")).rejects.toThrow("not found");
    expect(emailSourcesRepository.delete).not.toHaveBeenCalled();
  });
});

describe("create", () => {
  it("turns a duplicate signup URL into a friendly error", async () => {
    vi.mocked(emailSourcesRepository.create).mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" }));
    await expect(emailSourcesService.create("t1", { siteName: "x", signupUrl: "https://x.test" } as never)).rejects.toThrow("already on the list");
  });
});

describe("confirmation bookkeeping", () => {
  it("markSubscribedFromConfirmation sets subscribed + timestamp and clears any pending request", async () => {
    await emailSourcesService.markSubscribedFromConfirmation("t1", "s1");
    expect(emailSourcesRepository.update).toHaveBeenCalledWith("t1", "s1", { subscribed: true, subscribedAt: expect.any(Date), attemptRequestedAt: null, lastAttemptError: null });
  });
});

describe("emailSourceState", () => {
  it.each([
    [{ ...base, subscribed: true }, "subscribed"],
    [{ ...base, captchaProtected: true }, "captcha"],
    [{ ...base, lastAttemptResult: "captcha" }, "captcha"],
    [{ ...base, attemptRequestedAt: new Date() }, "queued"],
    [{ ...base, lastAttemptResult: "submitted" }, "awaiting_confirmation"],
    [{ ...base, lastAttemptResult: "failed" }, "failed"],
    [{ ...base, lastAttemptResult: "manual", lastAttemptError: "The site requires accepting: NDA" }, "needs_person"],
    [{ ...base, lastAttemptResult: "manual", attemptRequestedAt: new Date() }, "queued"],
    [base, "ready"],
    [{ ...base, submitSelector: null }, "manual"],
  ])("derives %#: %s", (source, expected) => {
    expect(emailSourceState(source as never)).toBe(expected);
  });
});

describe("signupHandoffReason", () => {
  const now = new Date("2026-09-19T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("flags the sites a person has to sign up to, with the reason", () => {
    expect(signupHandoffReason({ ...base, captchaProtected: true }, now)).toMatch(/captcha/);
    expect(signupHandoffReason({ ...base, lastAttemptResult: "manual", lastAttemptError: "The site requires accepting: NDA" }, now)).toBe("The site requires accepting: NDA");
    expect(signupHandoffReason({ ...base, lastAttemptResult: "manual" }, now)).toMatch(/only a person/);
    expect(signupHandoffReason({ ...base, lastAttemptResult: "failed", lastAttemptError: "TimeoutError: #email" }, now)).toBe("The automatic signup failed: TimeoutError: #email");
  });

  it("flags a submitted form whose confirmation email never came, but not a fresh one", () => {
    expect(signupHandoffReason({ ...base, lastAttemptResult: "submitted", lastAttemptAt: daysAgo(1) }, now)).toBeNull();
    expect(signupHandoffReason({ ...base, lastAttemptResult: "submitted", lastAttemptAt: daysAgo(4) }, now)).toMatch(/4 days ago/);
  });

  it("stays quiet for subscribed, queued and untouched sites", () => {
    expect(signupHandoffReason({ ...base, subscribed: true, lastAttemptResult: "captcha" }, now)).toBeNull();
    expect(signupHandoffReason({ ...base, attemptRequestedAt: now, lastAttemptResult: "manual" }, now)).toBeNull();
    expect(signupHandoffReason(base, now)).toBeNull();
  });

  it("listForTenant attaches the reason to every row", async () => {
    vi.mocked(emailSourcesRepository.findAllForTenant).mockResolvedValue([{ ...base, lastAttemptResult: "manual", lastAttemptError: "needs a password" }, base] as never);
    const rows = await emailSourcesService.listForTenant("t1", now);
    expect(rows.map((r) => r.handoffReason)).toEqual(["needs a password", null]);
  });
});
