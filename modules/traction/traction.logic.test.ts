import { describe, expect, it } from "vitest";
import {
  aggregate,
  formatCalendarDate,
  formatCompactCurrency,
  formatGoal,
  formatValue,
  goalMet,
  latestEntry,
  memberName,
  parseCalendarDate,
  parseMoney,
  periodLabel,
  periodStartFor,
  periodWindow,
  planningQuarters,
  quarterLabel,
  quarterOf,
  quarterRange,
  shiftQuarter,
} from "./traction.logic";

describe("quarters", () => {
  it("knows which quarter a day is in", () => {
    expect(quarterOf("2026-01-01")).toBe("2026-Q1");
    expect(quarterOf("2026-06-30")).toBe("2026-Q2");
    expect(quarterOf("2026-10-11")).toBe("2026-Q4");
  });

  it("gives a quarter's first and last day", () => {
    expect(quarterRange("2026-Q1")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(quarterRange("2024-Q1").end).toBe("2024-03-31");
    expect(quarterRange("2026-Q4")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
  });

  it("moves across years", () => {
    expect(shiftQuarter("2026-Q4", 1)).toBe("2027-Q1");
    expect(shiftQuarter("2026-Q1", -1)).toBe("2025-Q4");
    expect(shiftQuarter("2026-Q2", -6)).toBe("2024-Q4");
    expect(quarterLabel("2026-Q3")).toBe("Q3 2026");
  });
});

describe("planning quarters", () => {
  it("shows the current year plus as many of next year as the current quarter's number", () => {
    expect(planningQuarters("2026-Q1")).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1"]);
    expect(planningQuarters("2026-Q3")).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3"]);
    expect(planningQuarters("2026-Q4")).toHaveLength(8);
  });

  it("keeps older quarters that already have Rocks", () => {
    expect(planningQuarters("2026-Q1", ["2025-Q4", "2026-Q2", "bad"])).toEqual(["2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1"]);
  });
});

describe("Scorecard periods", () => {
  it("starts a week on Monday and a month on the 1st", () => {
    expect(periodStartFor("2026-10-11", "weekly")).toBe("2026-10-05"); // a Sunday → its Monday
    expect(periodStartFor("2026-10-05", "weekly")).toBe("2026-10-05");
    expect(periodStartFor("2026-10-11", "monthly")).toBe("2026-10-01");
  });

  it("builds the window of columns ending with the current period, oldest first", () => {
    expect(periodWindow("2026-10-11", "monthly")).toEqual(["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]);
    const weeks = periodWindow("2026-10-11", "weekly");
    expect(weeks).toHaveLength(13);
    expect(weeks.at(-1)).toBe("2026-10-05");
    expect(weeks[0]).toBe("2026-07-13");
    expect(periodWindow("2026-01-15", "monthly", 3)).toEqual(["2025-11-01", "2025-12-01", "2026-01-01"]);
  });

  it("labels a period, with the year only when it isn't the current one", () => {
    expect(periodLabel("2026-07-01", "monthly", 2026)).toBe("Jul");
    expect(periodLabel("2026-07-06", "weekly", 2026)).toBe("Jul 6");
    expect(periodLabel("2025-12-01", "monthly", 2026)).toBe("Dec ’25");
  });
});

describe("goals", () => {
  it("is green or red only when there is both a goal and a value", () => {
    expect(goalMet({ goalOperator: "gte", goalValue: 13500 }, 14682.5)).toBe(true);
    expect(goalMet({ goalOperator: "gte", goalValue: 500 }, 421)).toBe(false);
    expect(goalMet({ goalOperator: "lte", goalValue: 5 }, 5)).toBe(true);
    expect(goalMet({ goalOperator: "eq", goalValue: 3 }, 4)).toBe(false);
    expect(goalMet({ goalOperator: null, goalValue: null }, 10)).toBeNull();
    expect(goalMet({ goalOperator: "gte", goalValue: 10 }, null)).toBeNull();
  });

  it("formats values and goals by unit", () => {
    expect(formatValue(14682.5, "currency")).toBe("$14,682.50");
    expect(formatValue(421, "number")).toBe("421");
    expect(formatValue(3.66, "percent")).toBe("3.66%");
    expect(formatValue(null, "number")).toBe("");
    expect(formatGoal({ goalOperator: "gte", goalValue: 13500 }, "currency")).toBe("≥ $13,500");
    expect(formatGoal({ goalOperator: null, goalValue: null }, "currency")).toBeNull();
  });
});

describe("roll-ups", () => {
  it("sums, averages or takes the latest, skipping gaps", () => {
    expect(aggregate([22766.5, 27914.5, null], "sum")).toBe(50681);
    expect(aggregate([378, 396, 421], "latest")).toBe(421);
    expect(aggregate([2, null, 4], "average")).toBe(3);
    expect(aggregate([null, undefined], "sum")).toBeNull();
  });

  it("finds the latest entered period", () => {
    expect(latestEntry([{ periodStart: "2026-08-01", value: 396 }, { periodStart: "2026-09-01", value: 421 }, { periodStart: "2026-07-01", value: 378 }])).toEqual({ periodStart: "2026-09-01", value: 421 });
    expect(latestEntry([])).toBeNull();
  });
});

describe("V/TO values", () => {
  it("writes money the way people say it, and reads it back", () => {
    expect(formatCompactCurrency(3_000_000)).toBe("$3M");
    expect(formatCompactCurrency(600_000)).toBe("$600K");
    expect(formatCompactCurrency(1_500_000)).toBe("$1.5M");
    expect(formatCompactCurrency(null)).toBe("");
    expect(parseMoney("$20M")).toBe(20_000_000);
    expect(parseMoney("600k")).toBe(600_000);
    expect(parseMoney("1,250,000")).toBe(1_250_000);
    expect(parseMoney("lots")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });

  it("accepts only real dates", () => {
    expect(parseCalendarDate("Jan 30, 2036")).toBe("2036-01-30");
    expect(parseCalendarDate("2029-01-30")).toBe("2029-01-30");
    expect(parseCalendarDate("Jan 30, jkhjkhj")).toBe("");
    expect(formatCalendarDate("2027-01-30")).toBe("Jan 30, 2027");
    expect(formatCalendarDate("")).toBe("");
  });

  it("names a member, or nobody", () => {
    const members = [{ id: "u1", name: "Jay", email: "jay@x.test" }, { id: "u2", name: null, email: "kody@x.test" }];
    expect(memberName(members, "u1")).toBe("Jay");
    expect(memberName(members, "u2")).toBe("kody@x.test");
    expect(memberName(members, "nope")).toBeNull();
    expect(memberName(members, null)).toBeNull();
  });
});
