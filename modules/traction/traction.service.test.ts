import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./traction.repository", () => ({
  tractionRepository: {
    findMeasurables: vi.fn(),
    findMeasurable: vi.fn(),
    findEntries: vi.fn(),
    findLatestEntries: vi.fn(),
    upsertEntry: vi.fn(),
    deleteEntry: vi.fn(),
    nextMeasurableSortOrder: vi.fn(),
    insertMeasurable: vi.fn(),
    findRocks: vi.fn(),
    findIssues: vi.fn(),
    findIssue: vi.fn(),
    setIssueStatus: vi.fn(),
    findMeetings: vi.fn(),
    insertMeeting: vi.fn(),
    insertIssue: vi.fn(),
  },
}));
vi.mock("@/modules/activities/activities.service", () => ({
  activitiesService: { create: vi.fn(), listL10Todos: vi.fn(), unlinkIssue: vi.fn() },
}));
vi.mock("@/modules/tenancy/tenancy.service", () => ({
  tenancyService: { isMember: vi.fn(), listTenants: vi.fn() },
}));

import { tractionService } from "./traction.service";
import { tractionRepository } from "./traction.repository";
import { activitiesService } from "@/modules/activities/activities.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import type { MeasurableRow } from "./traction.types";

const repo = vi.mocked(tractionRepository);
const activities = vi.mocked(activitiesService);
const tenancy = vi.mocked(tenancyService);

const NOW = new Date("2026-10-11T15:00:00Z");
const revenue: MeasurableRow = { id: "m1", name: "Monthly revenue", ownerUserId: null, cadence: "monthly", goalOperator: "gte", goalValue: 13500, unit: "currency", aggregation: "sum", sortOrder: 0 };
const customers: MeasurableRow = { ...revenue, id: "m2", name: "Active customers", goalValue: 500, aggregation: "latest", sortOrder: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  tenancy.isMember.mockResolvedValue(true);
  repo.findMeasurables.mockResolvedValue([]);
  repo.findLatestEntries.mockResolvedValue([]);
  repo.findRocks.mockResolvedValue([]);
  repo.findIssues.mockResolvedValue([]);
  repo.findMeetings.mockResolvedValue([]);
  activities.listL10Todos.mockResolvedValue([]);
});

describe("owners must belong to the workspace", () => {
  it("refuses a measurable owned by someone outside it", async () => {
    tenancy.isMember.mockResolvedValue(false);
    await expect(
      tractionService.createMeasurable("t1", { name: "Revenue", ownerUserId: "stranger", cadence: "monthly", unit: "currency", aggregation: "sum" })
    ).rejects.toThrow("isn't a member");
    expect(repo.insertMeasurable).not.toHaveBeenCalled();
  });

  it("refuses an issue raised for an outside owner", async () => {
    tenancy.isMember.mockResolvedValue(false);
    await expect(tractionService.createIssue("t1", { title: "x", horizon: "short_term", ownerUserId: "stranger" }, "u1")).rejects.toThrow("isn't a member");
  });
});

describe("Scorecard cells", () => {
  it("snaps a date to the start of its period, so a cell never lands between columns", async () => {
    repo.findMeasurable.mockResolvedValue(revenue);
    await tractionService.setEntry("t1", { measurableId: "m1", periodStart: "2026-09-17", value: 27914.5 }, "u1");
    expect(repo.upsertEntry).toHaveBeenCalledWith("t1", "m1", "2026-09-01", 27914.5, "u1");
  });

  it("clears a cell when the value is emptied", async () => {
    repo.findMeasurable.mockResolvedValue(revenue);
    await tractionService.setEntry("t1", { measurableId: "m1", periodStart: "2026-09-01", value: null }, "u1");
    expect(repo.deleteEntry).toHaveBeenCalledWith("t1", "m1", "2026-09-01");
    expect(repo.upsertEntry).not.toHaveBeenCalled();
  });

  it("fetches from the start of the last column's quarter, so the Quarter column is complete", async () => {
    repo.findMeasurables.mockResolvedValue([revenue, { ...revenue, id: "w1", cadence: "weekly" }]);
    repo.findEntries.mockResolvedValue([]);
    const { periods, measurables } = await tractionService.getScorecard("t1", "weekly", "2026-10-11");
    expect(measurables.map((m) => m.id)).toEqual(["w1"]); // only the weekly ones
    expect(periods.at(-1)).toBe("2026-10-05");
    // The 13-week window starts in July; Q4 starts Oct 1, so the window start is the earlier bound.
    expect(repo.findEntries).toHaveBeenCalledWith("t1", ["w1"], "2026-07-13", "2026-10-05");
  });
});

describe("solving an issue", () => {
  it("closes it and creates the linked L10 To-Do", async () => {
    repo.findIssue.mockResolvedValue({ id: "i1", status: "open", title: "Home inspectors", ownerUserId: "u2" });
    const due = new Date("2026-10-18T12:00:00");
    await tractionService.solveIssue("t1", { id: "i1", solution: " Call 20 inspectors ", todo: { subject: " Build the list ", assignedToUserId: "u2", dueDate: due } }, "u1");
    expect(repo.setIssueStatus).toHaveBeenCalledWith("t1", "i1", "solved", "Call 20 inspectors");
    expect(activities.create).toHaveBeenCalledWith("t1", { type: "task", subject: "Build the list", dueDate: due, assignedToUserId: "u2" }, "u1", { l10Todo: true, issueId: "i1" });
  });

  it("can be solved without a To-Do", async () => {
    repo.findIssue.mockResolvedValue({ id: "i1", status: "open", title: "x", ownerUserId: null });
    await tractionService.solveIssue("t1", { id: "i1", solution: null, todo: null }, "u1");
    expect(activities.create).not.toHaveBeenCalled();
  });

  it("won't solve an issue twice", async () => {
    repo.findIssue.mockResolvedValue({ id: "i1", status: "solved", title: "x", ownerUserId: null });
    await expect(tractionService.solveIssue("t1", { id: "i1" }, "u1")).rejects.toThrow("already closed");
  });
});

describe("summary", () => {
  it("counts the latest number of each measurable against its goal, and stale numbers as not entered", async () => {
    repo.findMeasurables.mockResolvedValue([revenue, customers, { ...revenue, id: "m3", name: "Old" }]);
    repo.findLatestEntries.mockResolvedValue([
      { measurableId: "m1", periodStart: "2026-09-01", value: 27914.5 }, // last month: still current enough, green
      { measurableId: "m2", periodStart: "2026-10-01", value: 421 }, // red
      { measurableId: "m3", periodStart: "2026-06-01", value: 99999 }, // months old: not entered
    ]);
    const { scorecard } = await tractionService.getSummary("t1", NOW);
    expect(scorecard).toEqual({ onGoal: 1, offGoal: 1, notEntered: 1, total: 3 });
  });

  it("opens on this quarter's Rocks, or the latest quarter that has any", async () => {
    repo.findRocks.mockResolvedValue([
      { id: "r1", quarter: "2026-Q2", title: "Get 3rd truck", ownerUserId: null, dueDate: null, status: "complete", successCriteria: null },
      { id: "r2", quarter: "2026-Q2", title: "500 customers", ownerUserId: null, dueDate: null, status: "off_track", successCriteria: null },
      { id: "r3", quarter: "2026-Q2", title: "Old idea", ownerUserId: null, dueDate: null, status: "dropped", successCriteria: null },
    ]);
    const { rocks } = await tractionService.getSummary("t1", NOW);
    expect(rocks).toEqual({ quarter: "2026-Q2", total: 2, complete: 1, onTrack: 0, offTrack: 1 });
  });
});

describe("concluding the L10", () => {
  it("only accepts ratings from members, and records the average with the week's snapshot", async () => {
    repo.insertMeeting.mockResolvedValue({} as never);
    activities.listL10Todos.mockResolvedValue([
      { id: "a1", subject: "x", done: true, dueDate: null, assignedToUserId: null, updatedAt: NOW },
      { id: "a2", subject: "y", done: false, dueDate: null, assignedToUserId: null, updatedAt: NOW },
    ]);
    await tractionService.concludeMeeting("t1", { ratings: { u1: 8, u2: 9, u3: 7 } }, "u1", NOW);
    expect(tenancy.isMember).toHaveBeenCalledTimes(3);
    expect(repo.insertMeeting).toHaveBeenCalledWith("t1", expect.objectContaining({ averageRating: 8, todosDone: 1, todosTotal: 2, ratings: { u1: 8, u2: 9, u3: 7 } }));
  });

  it("rejects a rating from outside the workspace", async () => {
    tenancy.isMember.mockImplementation(async (_t, userId) => userId !== "stranger");
    await expect(tractionService.concludeMeeting("t1", { ratings: { stranger: 10 } }, "u1", NOW)).rejects.toThrow("isn't a member");
    expect(repo.insertMeeting).not.toHaveBeenCalled();
  });
});
