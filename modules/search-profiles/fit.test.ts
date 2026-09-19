import { describe, expect, it } from "vitest";
import { evaluateFit, formatUsdCompact } from "./fit";
import { hasCriteria, qualificationCriteriaSchema } from "./search-profiles.schema";

describe("evaluateFit", () => {
  it("returns null when the profile has no criteria (no badge)", () => {
    expect(evaluateFit(null, { estimatedRevenueUsd: 1 })).toBeNull();
    expect(evaluateFit({}, { estimatedRevenueUsd: 1 })).toBeNull();
    expect(evaluateFit({ signalKeywords: [] }, {})).toBeNull();
  });

  it("match: every stated requirement passes", () => {
    const fit = evaluateFit({ minRevenue: 1_000_000, maxRevenue: 5_000_000, minEmployees: 5 }, { estimatedRevenueUsd: 2_000_000, employeesCount: 14 });
    expect(fit?.status).toBe("match");
    expect(fit?.checks.map((c) => c.result)).toEqual(["pass", "pass"]);
  });

  it("miss: a stated figure is outside the range — with a readable reason", () => {
    const fit = evaluateFit({ minRevenue: 1_000_000, maxRevenue: 5_000_000 }, { estimatedRevenueUsd: 400_000 });
    expect(fit?.status).toBe("miss");
    expect(fit?.checks[0]).toMatchObject({ label: "Revenue", result: "fail" });
    expect(fit?.checks[0].detail).toBe("$400K (wanted at least $1M and at most $5M)");
  });

  it("a fail beats passes: miss even if other criteria match", () => {
    expect(evaluateFit({ minRevenue: 1_000_000, maxAskingPrice: 500_000 }, { estimatedRevenueUsd: 2_000_000, askingPriceUsd: 900_000 })?.status).toBe("miss");
  });

  it("missing data is never a fail: partial when some pass and some can't be checked", () => {
    const fit = evaluateFit({ minRevenue: 1_000_000, minEmployees: 5 }, { estimatedRevenueUsd: 2_000_000 });
    expect(fit?.status).toBe("partial");
    expect(fit?.checks.find((c) => c.label === "Employees")?.result).toBe("unknown");
  });

  it("unknown: nothing could be checked (the typical Google Maps record)", () => {
    expect(evaluateFit({ minRevenue: 1_000_000, minProfit: 100_000 }, { businessName: "Cool Air" })?.status).toBe("unknown");
  });

  it("checks profit, asking price (max only) and years in business", () => {
    const fit = evaluateFit(
      { minProfit: 150_000, maxAskingPrice: 1_000_000, minYearsInBusiness: 10 },
      { annualProfitUsd: 310_000, askingPriceUsd: 850_000, yearsInBusinessCount: 22 }
    );
    expect(fit?.status).toBe("match");
    expect(evaluateFit({ maxAskingPrice: 500_000 }, { askingPriceUsd: 850_000 })?.status).toBe("miss");
  });

  describe("signal keywords are a bonus, never a penalty", () => {
    const criteria = { signalKeywords: ["retiring", "owner selling"] };

    it("found in the job's matchedSignals -> match when they're the only criterion", () => {
      expect(evaluateFit(criteria, { matchedSignals: ["retiring"] })?.status).toBe("match");
    });
    it("found by the AI's own signals / summary -> also counts (case-insensitive)", () => {
      expect(evaluateFit(criteria, { signals: ["Owner Selling business"] })?.status).toBe("match");
      expect(evaluateFit(criteria, { summary: "Family HVAC firm, the owner is retiring." })?.status).toBe("match");
    });
    it("not found -> unknown, not miss", () => {
      expect(evaluateFit(criteria, { summary: "HVAC contractor." })?.status).toBe("unknown");
    });
    it("not found alongside a passing number -> still match (absence of a keyword doesn't downgrade)", () => {
      expect(evaluateFit({ minRevenue: 1_000_000, ...criteria }, { estimatedRevenueUsd: 2_000_000 })?.status).toBe("match");
    });
    it("found alongside only-uncheckable numbers -> lifted to partial", () => {
      expect(evaluateFit({ minRevenue: 1_000_000, ...criteria }, { matchedSignals: ["retiring"] })?.status).toBe("partial");
    });
    it("found alongside a failing number -> still miss", () => {
      expect(evaluateFit({ maxRevenue: 500_000, ...criteria }, { estimatedRevenueUsd: 2_000_000, matchedSignals: ["retiring"] })?.status).toBe("miss");
    });
  });
});

describe("formatUsdCompact", () => {
  it("formats thousands and millions compactly", () => {
    expect(formatUsdCompact(950)).toBe("$950");
    expect(formatUsdCompact(400_000)).toBe("$400K");
    expect(formatUsdCompact(1_000_000)).toBe("$1M");
    expect(formatUsdCompact(1_250_000)).toBe("$1.3M");
    expect(formatUsdCompact(12_000_000)).toBe("$12M");
  });
});

describe("qualificationCriteriaSchema", () => {
  it("rejects a max below its min", () => {
    const result = qualificationCriteriaSchema.safeParse({ minRevenue: 5_000_000, maxRevenue: 1_000_000 });
    expect(result.success).toBe(false);
  });
  it("accepts a partial object and rejects negatives / junk", () => {
    expect(qualificationCriteriaSchema.safeParse({ minRevenue: 100 }).success).toBe(true);
    expect(qualificationCriteriaSchema.safeParse({ minRevenue: -1 }).success).toBe(false);
    expect(qualificationCriteriaSchema.safeParse({ minEmployees: 2.5 }).success).toBe(false);
  });
  it("hasCriteria is false for empty objects and empty keyword lists", () => {
    expect(hasCriteria({})).toBe(false);
    expect(hasCriteria({ signalKeywords: [] })).toBe(false);
    expect(hasCriteria({ maxEmployees: 0 })).toBe(true);
  });
});
