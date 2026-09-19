import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./search-profiles.repository", () => ({
  searchProfilesRepository: { findById: vi.fn(), update: vi.fn(), create: vi.fn(), findAllForTenant: vi.fn() },
}));
vi.mock("@/lib/github-dispatch", () => ({ dispatchLeadEngineWorkflow: vi.fn() }));

import { normalizeCriteria, searchProfilesService } from "./search-profiles.service";
import { searchProfilesRepository } from "./search-profiles.repository";
import { dispatchLeadEngineWorkflow } from "@/lib/github-dispatch";

const NOW = new Date("2026-09-19T12:00:00Z");
const profile = { id: "p1", active: true, runRequestedAt: null };
const sources = { google_places: true, brave_search: false, broker_listings: false, company_site_scrape: true, marketplace_scrape: false };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(searchProfilesRepository.findById).mockResolvedValue(profile as never);
  vi.mocked(searchProfilesRepository.update).mockResolvedValue(profile as never);
  vi.mocked(dispatchLeadEngineWorkflow).mockResolvedValue("dispatched");
});

describe("requestRun (Run now)", () => {
  it("records the request on the profile and asks GitHub to start the engine for that profile", async () => {
    const result = await searchProfilesService.requestRun("t1", "p1", NOW);
    expect(searchProfilesRepository.update).toHaveBeenCalledWith("t1", "p1", { runRequestedAt: NOW });
    expect(dispatchLeadEngineWorkflow).toHaveBeenCalledWith({ task: "engine", profile_id: "p1" });
    expect(result).toEqual({ dispatch: "dispatched" });
  });

  it("the request is recorded even when GitHub isn't configured (it waits for the scheduled run)", async () => {
    vi.mocked(dispatchLeadEngineWorkflow).mockResolvedValue("not_configured");
    expect((await searchProfilesService.requestRun("t1", "p1", NOW)).dispatch).toBe("not_configured");
    expect(searchProfilesRepository.update).toHaveBeenCalled();
  });

  it("refuses a paused profile", async () => {
    vi.mocked(searchProfilesRepository.findById).mockResolvedValue({ ...profile, active: false } as never);
    await expect(searchProfilesService.requestRun("t1", "p1", NOW)).rejects.toThrow("paused");
    expect(dispatchLeadEngineWorkflow).not.toHaveBeenCalled();
  });

  it("refuses a second click while a request is still queued, but allows a retry after 15 minutes", async () => {
    vi.mocked(searchProfilesRepository.findById).mockResolvedValue({ ...profile, runRequestedAt: new Date(NOW.getTime() - 5 * 60_000) } as never);
    await expect(searchProfilesService.requestRun("t1", "p1", NOW)).rejects.toThrow("already queued");

    vi.mocked(searchProfilesRepository.findById).mockResolvedValue({ ...profile, runRequestedAt: new Date(NOW.getTime() - 20 * 60_000) } as never);
    await expect(searchProfilesService.requestRun("t1", "p1", NOW)).resolves.toEqual({ dispatch: "dispatched" });
  });

  it("another tenant's (or an unknown) profile reads as not found", async () => {
    vi.mocked(searchProfilesRepository.findById).mockResolvedValue(undefined);
    await expect(searchProfilesService.requestRun("tenant-b", "p1", NOW)).rejects.toThrow("not found");
    expect(searchProfilesRepository.findById).toHaveBeenCalledWith("tenant-b", "p1");
    expect(searchProfilesRepository.update).not.toHaveBeenCalled();
  });
});

describe("criteria handling", () => {
  it("normalizeCriteria drops blanks and duplicate keywords, and stores nothing when nothing is set", () => {
    expect(normalizeCriteria({ minRevenue: 1_000_000, maxRevenue: undefined, signalKeywords: ["retiring", "Retiring", " owner selling ", ""] })).toEqual({
      minRevenue: 1_000_000,
      signalKeywords: ["retiring", "owner selling"],
    });
    expect(normalizeCriteria({})).toBeNull();
    expect(normalizeCriteria({ signalKeywords: [" "] })).toBeNull();
    expect(normalizeCriteria(null)).toBeNull();
  });

  it("create stores normalized criteria", async () => {
    vi.mocked(searchProfilesRepository.create).mockResolvedValue(profile as never);
    await searchProfilesService.create("t1", {
      name: "n", category: "c", keywords: [], city: "Phoenix", state: "AZ", radiusMiles: 25, sources, maxLeadsPerRun: 10, frequencyHours: 24, active: true,
      criteria: { minProfit: 100_000, signalKeywords: ["retiring", "retiring"] },
    });
    expect(vi.mocked(searchProfilesRepository.create).mock.calls[0][1].criteria).toEqual({ minProfit: 100_000, signalKeywords: ["retiring"] });
  });

  it("update: omitted criteria stay untouched; an empty object clears them", async () => {
    await searchProfilesService.update("t1", "p1", { name: "renamed" });
    expect(vi.mocked(searchProfilesRepository.update).mock.calls[0][2]).not.toHaveProperty("criteria");

    await searchProfilesService.update("t1", "p1", { criteria: {} });
    expect(vi.mocked(searchProfilesRepository.update).mock.calls[1][2]).toMatchObject({ criteria: null });
  });

  it("still requires a discovery source", async () => {
    await expect(searchProfilesService.update("t1", "p1", { sources: { ...sources, google_places: false } })).rejects.toThrow("at least one source");
  });
});
