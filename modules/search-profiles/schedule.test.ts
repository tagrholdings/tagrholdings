import { describe, expect, it } from "vitest";
import { formatCountdown, nextEngineRunAt } from "./schedule";

const at = (iso: string) => new Date(iso).getTime();

describe("nextEngineRunAt", () => {
  it("waits for the frequency, then for the next 6-hourly tick", () => {
    // last ran 09:30, every 24h → due tomorrow 09:30 → next tick is 12:00 UTC that day.
    const next = nextEngineRunAt({ frequencyHours: 24, lastRunAt: new Date("2026-09-20T09:30:00Z"), runRequestedAt: null }, at("2026-09-21T00:00:00Z"));
    expect(next).toBe(at("2026-09-21T12:00:00Z"));
  });

  it("an overdue profile runs on the very next tick", () => {
    const next = nextEngineRunAt({ frequencyHours: 6, lastRunAt: new Date("2026-09-01T00:00:00Z"), runRequestedAt: null }, at("2026-09-21T13:10:00Z"));
    expect(next).toBe(at("2026-09-21T18:00:00Z"));
  });

  it("a profile that never ran, or has a queued Run now, runs on the next tick", () => {
    const now = at("2026-09-21T05:59:00Z");
    expect(nextEngineRunAt({ frequencyHours: 999, lastRunAt: null, runRequestedAt: null }, now)).toBe(at("2026-09-21T06:00:00Z"));
    expect(nextEngineRunAt({ frequencyHours: 999, lastRunAt: new Date("2026-09-21T05:00:00Z"), runRequestedAt: new Date("2026-09-21T05:30:00Z") }, now)).toBe(
      at("2026-09-21T06:00:00Z")
    );
  });

  it("accepts ISO strings (dates that crossed the server/client boundary)", () => {
    const next = nextEngineRunAt({ frequencyHours: 12, lastRunAt: "2026-09-21T00:00:00Z", runRequestedAt: null }, at("2026-09-21T01:00:00Z"));
    expect(next).toBe(at("2026-09-21T12:00:00Z"));
  });
});

describe("formatCountdown", () => {
  it("is coarse when far away and precise when close", () => {
    expect(formatCountdown(3 * 86_400_000 + 4 * 3_600_000)).toBe("3d 4h");
    expect(formatCountdown(2 * 3_600_000 + 5 * 60_000)).toBe("2h 05m");
    expect(formatCountdown(14 * 60_000 + 3000)).toBe("14m 03s");
    expect(formatCountdown(42_000)).toBe("42s");
  });

  it("never goes negative", () => {
    expect(formatCountdown(-5000)).toBe("0s");
  });
});
