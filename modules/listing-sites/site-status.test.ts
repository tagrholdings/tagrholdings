import { describe, expect, it } from "vitest";
import { explainSiteStatus } from "./site-status";

const CASES = [
  ["blocked", "bot_check"], ["blocked", "robots"], ["blocked", "refused"], ["blocked", "rate_limited"],
  ["error", "timeout"], ["error", "connection"], ["error", "server_error"], ["error", "not_found"], ["error", "unreadable"],
  ["no_listings", "no_listings_page"], ["no_listings", "js_only"], ["no_listings", "none_in_industries:3"],
  ["blocked", "HTTP 403"], ["error", "ReadError"],
] as const;

describe("explainSiteStatus", () => {
  it("never shows a technical code or HTTP number to people", () => {
    for (const [status, detail] of CASES) {
      const { label, short, why, steps } = explainSiteStatus(status, detail);
      expect(JSON.stringify({ label, short, why, steps })).not.toMatch(/\b403\b|HTTP|ReadError|_/);
    }
  });

  it("always says what to do (unless the site is fine)", () => {
    for (const [status, detail] of CASES) expect(explainSiteStatus(status, detail).steps.length).toBeGreaterThan(0);
  });

  it("says how many pages were read", () => {
    expect(explainSiteStatus("no_listings", "none_in_industries:3").short).toContain("3 pages");
    expect(explainSiteStatus("no_listings", "none_in_industries:1").short).toContain("1 page:");
  });

  it("offers Email sources for a site the engine is shut out of", () => {
    expect(explainSiteStatus("blocked", "bot_check").actions).toContain("email_sources");
  });

  it("falls back to the status for an unknown or missing reason", () => {
    expect(explainSiteStatus("blocked", null).label).toBe("Closed to automatic visits");
    expect(explainSiteStatus("error", "something new").tone).toBe("neutral");
  });
});
