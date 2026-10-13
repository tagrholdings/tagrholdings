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
    findRock: vi.fn(),
    insertRock: vi.fn(),
    updateRock: vi.fn(),
    findIssues: vi.fn(),
    findIssue: vi.fn(),
    setIssueStatus: vi.fn(),
    insertIssue: vi.fn(),
    findMeetings: vi.fn(),
    findLiveMeeting: vi.fn(),
    insertLiveMeeting: vi.fn(),
    setMeetingRating: vi.fn(),
    concludeMeeting: vi.fn(),
    findSeats: vi.fn(),
    updateSeat: vi.fn(),
    findReviews: vi.fn(),
    upsertReview: vi.fn(),
    findVto: vi.fn(),
    findL10Schedule: vi.fn(),
    claimL10Reminder: vi.fn(),
  },
}));
vi.mock("@/modules/activities/activities.service", () => ({
  activitiesService: { create: vi.fn(), listL10Todos: vi.fn(), unlinkIssue: vi.fn() },
}));
vi.mock("@/modules/team/team.service", () => ({
  teamService: { assertActivePerson: vi.fn(), personForUser: vi.fn(), listPeople: vi.fn() },
}));
vi.mock("@/modules/tenancy/tenancy.service", () => ({
  tenancyService: { listTenants: vi.fn() },
}));

import { tractionService } from "./traction.service";
import { tractionRepository } from "./traction.repository";
import { activitiesService } from "@/modules/activities/activities.service";
import { teamService } from "@/modules/team/team.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import type { MeasurableRow, RockRow, SeatRow } from "./traction.types";

const repo = vi.mocked(tractionRepository);
const activities = vi.mocked(activitiesService);
const team = vi.mocked(teamService);

const NOW = new Date("2026-10-11T15:00:00Z");
const revenue: MeasurableRow = { id: "m1", name: "Monthly revenue", ownerPersonId: "p1", cadence: "monthly", goalOperator: "gte", goalValue: 13500, goalValueMax: null, unit: "currency", aggregation: "sum", sortOrder: 0 };
const customers: MeasurableRow = { ...revenue, id: "m2", name: "Active customers", goalValue: 500, aggregation: "latest", sortOrder: 1 };
const rock = (overrides: Partial<RockRow>): RockRow => ({ id: "r1", quarter: "2026-Q4", title: "Rock", ownerPersonId: "p1", dueDate: null, status: "on_track", successCriteria: "Done", isCompany: true, oneYearGoalId: null, ...overrides });
const person = (id: string, userId: string | null, name = id) => ({ id, name, email: `${id}@x.test`, title: null, userId, archivedAt: null as Date | null });

beforeEach(() => {
  vi.resetAllMocks();
  team.assertActivePerson.mockResolvedValue(undefined);
  team.personForUser.mockResolvedValue(person("p-me", "u-me"));
  repo.findMeasurables.mockResolvedValue([]);
  repo.findLatestEntries.mockResolvedValue([]);
  repo.findRocks.mockResolvedValue([]);
  repo.findIssues.mockResolvedValue([]);
  repo.findMeetings.mockResolvedValue([]);
  repo.findSeats.mockResolvedValue([]);
  repo.findVto.mockResolvedValue(undefined as never);
  activities.listL10Todos.mockResolvedValue([]);
});

describe("owners are team people", () => {
  it("refuses an owner who isn't an active person of the workspace", async () => {
    team.assertActivePerson.mockRejectedValue(new Error("That person isn't on this workspace's team."));
    await expect(
      tractionService.createMeasurable("t1", { name: "Revenue", ownerPersonId: "stranger", cadence: "monthly", unit: "currency", aggregation: "sum" })
    ).rejects.toThrow("isn't on this workspace's team");
    expect(repo.insertMeasurable).not.toHaveBeenCalled();
  });

  it("records who raised an issue as their team person", async () => {
    await tractionService.createIssue("t1", { title: "x", issueType: "problem", horizon: "short_term" }, "u-me");
    expect(repo.insertIssue).toHaveBeenCalledWith("t1", expect.objectContaining({ raisedByPersonId: "p-me", issueType: "problem" }));
  });
});

describe("Scorecard cells", () => {
  it("snaps a date to the start of its period, so a cell never lands between columns", async () => {
    repo.findMeasurable.mockResolvedValue(revenue);
    await tractionService.setEntry("t1", { measurableId: "m1", periodStart: "2026-09-17", value: 27914.5 }, "u1");
    expect(repo.upsertEntry).toHaveBeenCalledWith("t1", "m1", "2026-09-01", 27914.5, "u1");
  });

  it("fetches from the start of the last column's quarter, so the Quarter column is complete", async () => {
    repo.findMeasurables.mockResolvedValue([revenue, { ...revenue, id: "w1", cadence: "weekly" }]);
    repo.findEntries.mockResolvedValue([]);
    const { periods, measurables } = await tractionService.getScorecard("t1", "weekly", "2026-10-11");
    expect(measurables.map((m) => m.id)).toEqual(["w1"]);
    expect(periods.at(-1)).toBe("2026-10-05");
    expect(repo.findEntries).toHaveBeenCalledWith("t1", ["w1"], "2026-07-13", "2026-10-05");
  });

  it("opens weekly unless every measurable is monthly", async () => {
    repo.findMeasurables.mockResolvedValue([revenue]);
    expect(await tractionService.defaultCadence("t1")).toBe("monthly");
    repo.findMeasurables.mockResolvedValue([revenue, { ...revenue, id: "w1", cadence: "weekly" }]);
    expect(await tractionService.defaultCadence("t1")).toBe("weekly");
  });
});

describe("closing out Rocks at quarter end (done is binary)", () => {
  it("carries an unfinished Rock into a fresh copy next quarter and marks the old one rolled over", async () => {
    repo.findRock.mockResolvedValue(rock({ quarter: "2026-Q3", status: "off_track" }));
    await tractionService.closeOutRock("t1", "r1", "carry");
    expect(repo.insertRock).toHaveBeenCalledWith("t1", expect.objectContaining({ quarter: "2026-Q4", status: "on_track", dueDate: "2026-12-31", ownerPersonId: "p1" }));
    expect(repo.updateRock).toHaveBeenCalledWith("t1", "r1", { status: "rolled_over" });
  });

  it("won't close out a Rock twice, nor edit a rolled-over one", async () => {
    repo.findRock.mockResolvedValue(rock({ status: "rolled_over" }));
    await expect(tractionService.closeOutRock("t1", "r1", "drop")).rejects.toThrow("already closed out");
    await expect(tractionService.setRockStatus("t1", "r1", "complete")).rejects.toThrow("carried into the next quarter");
  });
});

describe("IDS: resolving an issue by its kind", () => {
  const todo = { subject: " Build the list ", assignedToPersonId: "p2", dueDate: new Date("2026-10-18T12:00:00") };

  it("solves a problem and creates every To-Do, linked to the issue", async () => {
    repo.findIssue.mockResolvedValue({ id: "i1", status: "open", title: "x", issueType: "problem", ownerPersonId: null });
    await tractionService.resolveIssue("t1", { id: "i1", outcome: "solved", solution: " Call 20 inspectors ", todos: [todo, { ...todo, subject: "Second" }] }, "u1");
    expect(repo.setIssueStatus).toHaveBeenCalledWith("t1", "i1", "solved", "Call 20 inspectors", { outcome: "solved", horizon: undefined });
    expect(activities.create).toHaveBeenCalledTimes(2);
    expect(activities.create).toHaveBeenCalledWith("t1", { type: "task", subject: "Build the list", dueDate: todo.dueDate, assignedToPersonId: "p2" }, "u1", { l10Todo: true, issueId: "i1" });
  });

  it("parks an idea decided 'later' on the long-term list, still open", async () => {
    repo.findIssue.mockResolvedValue({ id: "i1", status: "open", title: "x", issueType: "idea", ownerPersonId: null });
    await tractionService.resolveIssue("t1", { id: "i1", outcome: "later" }, "u1");
    expect(repo.setIssueStatus).toHaveBeenCalledWith("t1", "i1", "open", null, { outcome: "later", horizon: "long_term" });
  });

  it("rejects an outcome that doesn't fit the kind, and To-Dos on a 'no'", async () => {
    repo.findIssue.mockResolvedValue({ id: "i1", status: "open", title: "x", issueType: "problem", ownerPersonId: null });
    await expect(tractionService.resolveIssue("t1", { id: "i1", outcome: "escalated" }, "u1")).rejects.toThrow("doesn't fit");
    repo.findIssue.mockResolvedValue({ id: "i1", status: "open", title: "x", issueType: "idea", ownerPersonId: null });
    await expect(tractionService.resolveIssue("t1", { id: "i1", outcome: "no", todos: [todo] }, "u1")).rejects.toThrow("To-Dos come with a decision");
    expect(repo.setIssueStatus).not.toHaveBeenCalled();
  });

  it("won't resolve an issue twice", async () => {
    repo.findIssue.mockResolvedValue({ id: "i1", status: "solved", title: "x", issueType: "problem", ownerPersonId: null });
    await expect(tractionService.resolveIssue("t1", { id: "i1", outcome: "solved" }, "u1")).rejects.toThrow("already closed");
  });
});

describe("the live L10", () => {
  it("each member rates for themselves; a teammate without a login can be rated for, one with a login can't", async () => {
    repo.setMeetingRating.mockResolvedValue({ id: "mt", ratings: {} });
    await tractionService.rateMeeting("t1", { meetingId: "mt", rating: 9 }, "u-me");
    expect(repo.setMeetingRating).toHaveBeenCalledWith("t1", "mt", "p-me", 9);

    team.listPeople.mockResolvedValue([person("p-tech", null, "Rex"), person("p-jay", "u-jay", "Jay")]);
    await tractionService.rateMeeting("t1", { meetingId: "mt", personId: "p-tech", rating: 8 }, "u-me");
    expect(repo.setMeetingRating).toHaveBeenCalledWith("t1", "mt", "p-tech", 8);
    await expect(tractionService.rateMeeting("t1", { meetingId: "mt", personId: "p-jay", rating: 3 }, "u-me")).rejects.toThrow("Jay rates for themselves");
  });

  it("requires a reason to conclude a meeting that averaged under 8", async () => {
    repo.findLiveMeeting.mockResolvedValue({ id: "mt", startedAt: NOW, ratings: { a: 7, b: 8 } });
    await expect(tractionService.concludeMeeting("t1", { meetingId: "mt" }, NOW)).rejects.toThrow("averaged 7.5");
    repo.concludeMeeting.mockResolvedValue({} as never);
    await tractionService.concludeMeeting("t1", { meetingId: "mt", improvement: "Start on time" }, NOW);
    expect(repo.concludeMeeting).toHaveBeenCalledWith("t1", "mt", expect.objectContaining({ averageRating: 7.5, improvement: "Start on time" }));
  });

  it("counts only the issues solved during this meeting", async () => {
    repo.findLiveMeeting.mockResolvedValue({ id: "mt", startedAt: new Date("2026-10-11T14:00:00Z"), ratings: { a: 9 } });
    repo.findIssues.mockResolvedValue([
      { status: "solved", solvedAt: new Date("2026-10-11T14:30:00Z") },
      { status: "solved", solvedAt: new Date("2026-10-09T10:00:00Z") },
    ] as never);
    repo.concludeMeeting.mockResolvedValue({} as never);
    await tractionService.concludeMeeting("t1", { meetingId: "mt" }, NOW);
    expect(repo.concludeMeeting).toHaveBeenCalledWith("t1", "mt", expect.objectContaining({ issuesSolved: 1 }));
  });
});

describe("L10 reminders", () => {
  it("claims the next meeting once it is within the hour, with its agenda and recipients", async () => {
    vi.mocked(tenancyService.listTenants).mockResolvedValue([{ id: "t1", slug: "grounded", name: "Grounded" }]);
    // Sunday 2026-10-11 15:00 UTC = 8:00 Phoenix; the meeting is Sunday 8:30 Phoenix, 30 minutes away.
    repo.findL10Schedule.mockResolvedValue({ weekday: 0, startTime: "08:30", timezone: "America/Phoenix", remindedFor: null });
    repo.claimL10Reminder.mockResolvedValue(true);
    repo.findLiveMeeting.mockResolvedValue(undefined);
    team.listPeople.mockResolvedValue([person("p1", "u1"), { ...person("p2", null), archivedAt: new Date() }]);
    const due = await tractionService.claimDueL10Reminders(NOW);
    expect(due).toHaveLength(1);
    expect(due[0].meetingAt.toISOString()).toBe("2026-10-11T15:30:00.000Z");
    expect(due[0].people).toEqual([{ name: "p1", email: "p1@x.test", userId: "u1" }]);
  });

  it("sends nothing when the meeting is more than an hour away, or already claimed", async () => {
    vi.mocked(tenancyService.listTenants).mockResolvedValue([{ id: "t1", slug: "g", name: "G" }]);
    repo.findL10Schedule.mockResolvedValue({ weekday: 0, startTime: "10:00", timezone: "America/Phoenix", remindedFor: null });
    expect(await tractionService.claimDueL10Reminders(NOW)).toEqual([]);
    repo.findL10Schedule.mockResolvedValue({ weekday: 0, startTime: "08:30", timezone: "America/Phoenix", remindedFor: null });
    repo.claimL10Reminder.mockResolvedValue(false);
    expect(await tractionService.claimDueL10Reminders(NOW)).toEqual([]);
  });
});

describe("People Analyzer privacy", () => {
  const seats: SeatRow[] = [
    { id: "s-int", name: "Integrator", responsibilities: [], parentSeatId: null, personId: "p-me", sortOrder: 0 },
    { id: "s-ops", name: "Operations", responsibilities: [], parentSeatId: "s-int", personId: "p-ops", sortOrder: 1 },
    { id: "s-tech", name: "Tech", responsibilities: [], parentSeatId: "s-ops", personId: "p-tech", sortOrder: 2 },
  ];
  const people = [person("p-me", "u-me"), person("p-ops", "u-ops"), person("p-tech", null)];

  beforeEach(() => {
    team.listPeople.mockResolvedValue(people);
    repo.findSeats.mockResolvedValue(seats);
    repo.findReviews.mockResolvedValue([]);
  });

  it("shows a manager themselves and their direct reports only — not the reports' reports", async () => {
    const view = await tractionService.getPeopleAnalyzer("t1", "u-me", false, "2026-Q4");
    expect(view.people.map((p) => p.id)).toEqual(["p-me", "p-ops"]);
    expect(view.canManagerReview).toEqual(["p-ops"]);
    expect(view.canSelfReview).toEqual(["p-me"]);
  });

  it("only lets the manager (or an admin) write the manager's review, and only the person their self review", async () => {
    const review = { personId: "p-tech", quarter: "2026-Q4", kind: "manager" as const, valuesRatings: {}, getsIt: true, wantsIt: true, capacity: true };
    await expect(tractionService.saveReview("t1", review, "u-me", false)).rejects.toThrow("Only this person's manager");
    await tractionService.saveReview("t1", review, "u-ops", false);
    await tractionService.saveReview("t1", review, "u-me", true);
    await expect(tractionService.saveReview("t1", { ...review, kind: "self" }, "u-me", true)).rejects.toThrow("Only the person themselves");
    expect(repo.upsertReview).toHaveBeenCalledTimes(2);
  });

  it("won't let a seat sit under its own branch", async () => {
    await expect(tractionService.updateSeat("t1", { id: "s-int", name: "Integrator", responsibilities: [], parentSeatId: "s-tech" })).rejects.toThrow("can't sit under itself");
  });
});

describe("summary", () => {
  it("counts the latest number of each measurable against its goal, and stale numbers as not entered", async () => {
    repo.findMeasurables.mockResolvedValue([revenue, customers, { ...revenue, id: "m3", name: "Old" }]);
    repo.findLatestEntries.mockResolvedValue([
      { measurableId: "m1", periodStart: "2026-09-01", value: 27914.5 },
      { measurableId: "m2", periodStart: "2026-10-01", value: 421 },
      { measurableId: "m3", periodStart: "2026-06-01", value: 99999 },
    ]);
    const { scorecard } = await tractionService.getSummary("t1", NOW);
    expect(scorecard).toEqual({ onGoal: 1, offGoal: 1, notEntered: 1, total: 3 });
  });

  it("scores last quarter's Rocks binary — rolled over and dropped count as not done", async () => {
    repo.findRocks.mockResolvedValue([
      rock({ id: "a", quarter: "2026-Q3", status: "complete" }),
      rock({ id: "b", quarter: "2026-Q3", status: "rolled_over" }),
      rock({ id: "c", quarter: "2026-Q3", status: "dropped" }),
      rock({ id: "d", quarter: "2026-Q3", status: "complete" }),
    ]);
    const { lastQuarterRockRate } = await tractionService.getSummary("t1", NOW);
    expect(lastQuarterRockRate).toEqual({ quarter: "2026-Q3", rate: 50 });
  });
});
