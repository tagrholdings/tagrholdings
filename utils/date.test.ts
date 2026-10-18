import { describe, expect, it } from "vitest";
import { browserTimeZone, formatDueTime, toZonedInputValues } from "./date";



describe("toZonedInputValues", () => {
  it("reads an instant on the wall clock of another zone", () => {
    expect(toZonedInputValues("2026-10-20T22:00:00Z", "America/Phoenix")).toEqual({ date: "2026-10-20", time: "15:00" });
    expect(toZonedInputValues("2026-10-20T22:00:00Z", "America/Sao_Paulo")).toEqual({ date: "2026-10-20", time: "19:00" });
    expect(toZonedInputValues("2026-10-20T02:30:00Z", "America/Phoenix")).toEqual({ date: "2026-10-19", time: "19:30" });
  });
});

describe("formatDueTime", () => {
  it("is null for a date-only activity", () => {
    expect(formatDueTime(new Date(2026, 9, 20))).toBeNull();
  });

  it("shows one time when the zone is the viewer's own", () => {
    expect(formatDueTime(new Date(2026, 9, 20, 15, 0), browserTimeZone())).toBe("3:00 PM");
  });

  it("shows both zones when they differ", () => {
    const label = formatDueTime("2026-10-20T22:00:00Z", "Pacific/Kiritimati");
    expect(label).toContain("·");
    expect(label).toContain("12:00 PM");
  });
});
