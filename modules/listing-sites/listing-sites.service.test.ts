import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./listing-sites.repository", () => ({
  listingSitesRepository: { findAllForTenant: vi.fn(), findByDomain: vi.fn(), create: vi.fn(), setActive: vi.fn() },
}));

import { UserFacingError } from "@/lib/errors";
import { listingSitesService } from "./listing-sites.service";
import { listingSitesRepository } from "./listing-sites.repository";
import { createListingSiteSchema, needsManualCheck } from "./listing-sites.types";

const site = {
  id: "s1", siteName: "Synergy", domain: "synergybb.com", siteUrl: "https://synergybb.com/", listingsUrl: null, source: "manual", active: true,
  status: "pending", statusDetail: null, lastCrawledAt: null, lastListingCount: 0, createdAt: new Date(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listingSitesRepository.findByDomain).mockResolvedValue(undefined);
  vi.mocked(listingSitesRepository.create).mockResolvedValue(site as never);
});

describe("create", () => {
  it("stores one row per registrable domain, named after the host when no name is given", async () => {
    await listingSitesService.create("t1", { siteUrl: "https://www.synergybb.com/businesses-for-sale/?utm=1" });
    expect(listingSitesRepository.findByDomain).toHaveBeenCalledWith("t1", "synergybb.com");
    expect(listingSitesRepository.create).toHaveBeenCalledWith("t1", {
      siteName: expect.stringContaining("synergybb.com"),
      domain: "synergybb.com",
      siteUrl: "https://www.synergybb.com/businesses-for-sale/",
      listingsUrl: null,
      source: "manual",
    });
  });

  it("keeps a given name and listings page", async () => {
    await listingSitesService.create("t1", { siteUrl: "https://synergybb.com", siteName: " Synergy ", listingsUrl: "https://synergybb.com/l" });
    expect(listingSitesRepository.create).toHaveBeenCalledWith("t1", expect.objectContaining({ siteName: "Synergy", listingsUrl: "https://synergybb.com/l" }));
  });

  it("rejects a site that is already on the list", async () => {
    vi.mocked(listingSitesRepository.findByDomain).mockResolvedValue(site as never);
    await expect(listingSitesService.create("t1", { siteUrl: "https://synergybb.com" })).rejects.toThrow(UserFacingError);
    expect(listingSitesRepository.create).not.toHaveBeenCalled();
  });

  it("switches an ignored site back on instead of duplicating it", async () => {
    vi.mocked(listingSitesRepository.findByDomain).mockResolvedValue({ ...site, active: false } as never);
    vi.mocked(listingSitesRepository.setActive).mockResolvedValue({ ...site, active: true } as never);
    const result = await listingSitesService.create("t1", { siteUrl: "https://synergybb.com" });
    expect(listingSitesRepository.setActive).toHaveBeenCalledWith("t1", "s1", true);
    expect(result.active).toBe(true);
    expect(listingSitesRepository.create).not.toHaveBeenCalled();
  });

  it("reports a lost race with an identical add as a duplicate", async () => {
    vi.mocked(listingSitesRepository.create).mockResolvedValue(undefined);
    await expect(listingSitesService.create("t1", { siteUrl: "https://synergybb.com" })).rejects.toThrow(/already on the list/);
  });

  it.each(["not a url", "https://localhost", "https://nodots"])("rejects %s", async (siteUrl) => {
    await expect(listingSitesService.create("t1", { siteUrl })).rejects.toThrow(UserFacingError);
  });
});

describe("setActive", () => {
  it("updates through the repository, scoped to the tenant", async () => {
    vi.mocked(listingSitesRepository.setActive).mockResolvedValue({ ...site, active: false } as never);
    await listingSitesService.setActive("t1", "s1", false);
    expect(listingSitesRepository.setActive).toHaveBeenCalledWith("t1", "s1", false);
  });

  it("says so when the site isn't in this tenant", async () => {
    vi.mocked(listingSitesRepository.setActive).mockResolvedValue(undefined);
    await expect(listingSitesService.setActive("t1", "other", false)).rejects.toThrow(/not found/i);
  });
});

describe("needsManualCheck", () => {
  it.each([
    [{ active: true, status: "blocked" }, true],
    [{ active: true, status: "error" }, true],
    [{ active: true, status: "no_listings" }, false],
    [{ active: true, status: "ok" }, false],
    [{ active: true, status: "pending" }, false],
    [{ active: false, status: "blocked" }, false], // ignored on purpose
  ])("%j -> %s", (s, expected) => {
    expect(needsManualCheck(s as never)).toBe(expected);
  });
});

describe("createListingSiteSchema", () => {
  it("accepts a bare address and an empty listings page", () => {
    expect(createListingSiteSchema.safeParse({ siteUrl: "https://synergybb.com", listingsUrl: "" }).success).toBe(true);
  });
  it("refuses non-http(s) addresses", () => {
    expect(createListingSiteSchema.safeParse({ siteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(createListingSiteSchema.safeParse({ siteUrl: "ftp://x.com" }).success).toBe(false);
  });
});
