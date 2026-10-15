import { z } from "zod";
import { isValidTimeZone, parseCalendarDate, parseMoney, type Aggregation, type Cadence, type GoalOperator, type Unit } from "./traction.logic";

export const CADENCES = ["weekly", "monthly"] as const;
export const GOAL_OPERATORS = ["gte", "lte", "eq", "between"] as const;
export const UNITS = ["number", "currency", "percent"] as const;
export const AGGREGATIONS = ["sum", "average", "latest"] as const;
export const ROCK_STATUSES = ["on_track", "off_track", "complete", "dropped", "rolled_over"] as const;
/** What someone can set by hand; `rolled_over` is only ever set by the quarter rollover. */
export const SETTABLE_ROCK_STATUSES = ["on_track", "off_track", "complete", "dropped"] as const;
export const ISSUE_HORIZONS = ["short_term", "long_term"] as const;
export const ISSUE_TYPES = ["problem", "idea", "obstacle"] as const;
export const ISSUE_OUTCOMES = ["solved", "yes", "no", "later", "removed", "escalated"] as const;
export const PROCESS_AREAS = ["hr", "sales", "operations", "customer_service", "finance", "other"] as const;
export const PROCESS_STAGES = ["documented", "trained", "followed"] as const;
export const VALUE_RATINGS = ["+", "+/-", "-"] as const;

export type RockStatus = (typeof ROCK_STATUSES)[number];
export type IssueHorizon = (typeof ISSUE_HORIZONS)[number];
export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssueOutcome = (typeof ISSUE_OUTCOMES)[number];
export type ProcessArea = (typeof PROCESS_AREAS)[number];
export type ProcessStage = (typeof PROCESS_STAGES)[number];

export const ROCK_STATUS_LABELS: Record<RockStatus, string> = {
  on_track: "On track",
  off_track: "Off track",
  complete: "Complete",
  dropped: "Dropped",
  rolled_over: "Rolled over",
};
export const UNIT_LABELS: Record<Unit, string> = { number: "Number", currency: "Dollars", percent: "Percent" };
export const AGGREGATION_LABELS: Record<Aggregation, string> = { sum: "Total", average: "Average", latest: "Latest" };
export const CADENCE_LABELS: Record<Cadence, string> = { weekly: "Weekly", monthly: "Monthly" };
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = { problem: "Problem", idea: "Idea", obstacle: "Obstacle" };
export const PROCESS_AREA_LABELS: Record<ProcessArea, string> = {
  hr: "HR",
  sales: "Sales",
  operations: "Operations",
  customer_service: "Customer service",
  finance: "Finance",
  other: "Other",
};
export const PROCESS_STAGE_LABELS: Record<ProcessStage, string> = { documented: "Documented", trained: "Trained", followed: "Followed by all" };

/** Which ways an issue can be closed, by kind (IDS: problems are solved, ideas decided, obstacles removed or escalated). */
export const OUTCOMES_BY_TYPE: Record<IssueType, IssueOutcome[]> = {
  problem: ["solved"],
  idea: ["yes", "no", "later"],
  obstacle: ["removed", "escalated"],
};

const uuid = z.uuid();
const personId = z.uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-06-30.");
const quarter = z.string().regex(/^\d{4}-Q[1-4]$/, "Use a quarter like 2026-Q3.");

// ───────────── Scorecard ─────────────

const measurableFields = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  ownerPersonId: personId,
  cadence: z.enum(CADENCES),
  unit: z.enum(UNITS),
  aggregation: z.enum(AGGREGATIONS),
  goalOperator: z.enum(GOAL_OPERATORS).nullish(),
  goalValue: z.number().finite().nullish(),
  goalValueMax: z.number().finite().nullish(),
});
type GoalInput = { goalOperator?: string | null; goalValue?: number | null; goalValueMax?: number | null };
const goalIsComplete = (m: GoalInput) =>
  m.goalOperator == null ? m.goalValue == null : m.goalValue != null && (m.goalOperator !== "between" || (m.goalValueMax != null && m.goalValueMax >= m.goalValue));
const goalMessage = { message: "Set the comparison and its number (a range needs both ends, low to high), or no goal at all.", path: ["goalValue"] };

export const createMeasurableSchema = measurableFields.refine(goalIsComplete, goalMessage);
export const updateMeasurableSchema = measurableFields.extend({ id: uuid }).refine(goalIsComplete, goalMessage);
export type NewMeasurable = z.infer<typeof createMeasurableSchema>;
export type MeasurableUpdate = z.infer<typeof updateMeasurableSchema>;

/** `value: null` clears the cell. */
export const setEntrySchema = z.object({ measurableId: uuid, periodStart: isoDate, value: z.number().finite().nullable() });
export type EntryInput = z.infer<typeof setEntrySchema>;

export const archiveMeasurableSchema = z.object({ id: uuid });

// ───────────── Rocks ─────────────

export const rockFieldsSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  quarter,
  ownerPersonId: personId,
  dueDate: isoDate.nullish(),
  successCriteria: z.string().trim().min(1, "Write what done looks like.").max(2000),
  status: z.enum(SETTABLE_ROCK_STATUSES),
  isCompany: z.boolean(),
  oneYearGoalId: z.string().max(100).nullish(),
});
export const createRockSchema = rockFieldsSchema;
export const updateRockSchema = rockFieldsSchema.extend({ id: uuid });
export const setRockStatusSchema = z.object({ id: uuid, status: z.enum(SETTABLE_ROCK_STATUSES) });
export const deleteRockSchema = z.object({ id: uuid });
/** Quarter end: an unfinished Rock is completed after all, carried into the next quarter, or dropped. */
export const closeOutRockSchema = z.object({ id: uuid, action: z.enum(["complete", "carry", "drop"]) });
export type NewRock = z.infer<typeof createRockSchema>;
export type RockUpdate = z.infer<typeof updateRockSchema>;

// ───────────── Issues ─────────────

const issueFields = z.object({
  title: z.string().trim().min(1, "Describe the issue.").max(200),
  issueType: z.enum(ISSUE_TYPES),
  rootCause: z.string().trim().max(500).nullish(),
  notes: z.string().max(5000).nullish(),
  horizon: z.enum(ISSUE_HORIZONS),
  ownerPersonId: personId.nullish(),
});
export const createIssueSchema = issueFields.extend({ measurableId: uuid.nullish(), rockId: uuid.nullish() });
export type NewIssue = z.infer<typeof createIssueSchema>;
export const updateIssueSchema = issueFields.extend({ id: uuid });
export type IssueUpdate = z.infer<typeof updateIssueSchema>;

/** An action item out of IDS: who + what + when. */
const todoItem = z.object({
  subject: z.string().trim().min(1, "Write the To-Do.").max(200),
  assignedToPersonId: personId,
  dueDate: z.date().nullish(),
});

/** Closing an issue the IDS way: an outcome that fits its kind, the decision, and any number of To-Dos. */
export const resolveIssueSchema = z.object({
  id: uuid,
  outcome: z.enum(ISSUE_OUTCOMES),
  solution: z.string().max(2000).nullish(),
  todos: z.array(todoItem).max(10).default([]),
});
export type ResolveIssueInput = z.input<typeof resolveIssueSchema>;

export const issueIdSchema = z.object({ id: uuid });
/** The open issues of one list in their new order (first = rank 1). */
export const reorderIssuesSchema = z.object({ ids: z.array(uuid).max(200) });

// ───────────── L10 meeting ─────────────

export const startMeetingSchema = z.object({});
/** A member rates the meeting for themselves; anyone may rate for a teammate who has no login. */
export const rateMeetingSchema = z.object({ meetingId: uuid, personId: personId.nullish(), rating: z.number().int().min(1).max(10) });
export const concludeMeetingSchema = z.object({
  meetingId: uuid,
  headlines: z.string().max(5000).nullish(),
  improvement: z.string().max(2000).nullish(),
});
export type ConcludeMeetingInput = z.infer<typeof concludeMeetingSchema>;

/** New L10 To-Do created inside the meeting (always an `l10Todo` task). */
export const createTodoSchema = z.object({
  subject: z.string().trim().min(1, "Write the To-Do.").max(200),
  assignedToPersonId: personId,
  dueDate: z.date().nullish(),
});
export type NewTodo = z.infer<typeof createTodoSchema>;

export const saveL10ScheduleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 08:00."),
  timezone: z.string().refine(isValidTimeZone, "Pick a real time zone."),
});
export type L10ScheduleInput = z.infer<typeof saveL10ScheduleSchema>;

// ───────────── V/TO ─────────────

const line = z.string().max(500);
const lines = z.array(line).max(30);
/** A calendar date "YYYY-MM-DD" or "" — anything that isn't a real date (old free text included) becomes "". */
const calendarDate = z.preprocess((v) => parseCalendarDate(v), z.string());
/** Dollars as a number, or null. Old text like "$3M" or "600K" is read as the number it names. */
const money = z.preprocess((v) => parseMoney(v), z.number().nullable());
/** A whole count (people, customers), or null. */
const count = z.preprocess((v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null), z.number().int().nullable());
/** A core value: its name plus 2-3 observable behaviors. Old plain strings become a value with no behaviors yet. */
const coreValue = z.preprocess((v) => (typeof v === "string" ? { name: v, behaviors: [] } : v), z.object({ name: line, behaviors: lines.default([]) }));
/**
 * A 1-Year goal with a stable id, so Rocks can point at it across edits. Old plain strings get an id from their
 * position — written back with the next save.
 */
const goals = z.preprocess(
  (v) => (Array.isArray(v) ? v.map((g, i) => (typeof g === "string" ? { id: `goal-${i + 1}`, text: g } : g)) : v),
  z.array(z.object({ id: z.string().max(100), text: line })).max(30)
);

export const vtoContentSchema = z.object({
  coreValues: z.array(coreValue).max(30).default([]),
  purpose: line.default(""),
  niche: line.default(""),
  tenYear: z.object({ date: calendarDate, revenue: money, picture: line.default("") }).default({ date: "", revenue: null, picture: "" }),
  marketing: z
    .object({ targetMarket: line.default(""), uniques: z.array(line).max(3).default([]), provenProcess: line.default(""), guarantee: line.default("") })
    .default({ targetMarket: "", uniques: [], provenProcess: "", guarantee: "" }),
  threeYear: z
    .object({ date: calendarDate, revenue: money, profit: money, headcount: count, customers: count, measurables: line.default(""), picture: lines.default([]) })
    .default({ date: "", revenue: null, profit: null, headcount: null, customers: null, measurables: "", picture: [] }),
  oneYear: z
    .object({ date: calendarDate, revenue: money, profit: money, measurables: line.default(""), budget: line.default(""), goals: goals.default([]) })
    .default({ date: "", revenue: null, profit: null, measurables: "", budget: "", goals: [] }),
});
export type VtoContent = z.infer<typeof vtoContentSchema>;
export const saveVtoSchema = z.object({ content: vtoContentSchema });

// ───────────── People: seats and the People Analyzer ─────────────

export const seatFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name the seat.").max(120),
  responsibilities: z.array(z.string().trim().min(1).max(200)).max(7),
  parentSeatId: uuid.nullish(),
  personId: personId.nullish(),
});
export const createSeatSchema = seatFieldsSchema;
export const updateSeatSchema = seatFieldsSchema.extend({ id: uuid });
export type NewSeat = z.infer<typeof createSeatSchema>;
export type SeatUpdate = z.infer<typeof updateSeatSchema>;
export const seatIdSchema = z.object({ id: uuid });

export const saveReviewSchema = z.object({
  personId,
  quarter,
  kind: z.enum(["manager", "self"]),
  valuesRatings: z.record(z.string().max(500), z.enum(VALUE_RATINGS)),
  getsIt: z.boolean().nullable(),
  wantsIt: z.boolean().nullable(),
  capacity: z.boolean().nullable(),
  notes: z.string().max(5000).nullish(),
});
export type ReviewInput = z.infer<typeof saveReviewSchema>;

// ───────────── Process ─────────────

export const processFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name the process.").max(120),
  area: z.enum(PROCESS_AREAS),
  ownerPersonId: personId.nullish(),
  steps: z.array(z.object({ title: z.string().trim().min(1, "Name the step.").max(200), detail: z.string().max(1000).optional() })).min(1, "Add at least one step.").max(20, "Up to 20 steps."),
  stage: z.enum(PROCESS_STAGES),
});
export const createProcessSchema = processFieldsSchema;
export const updateProcessSchema = processFieldsSchema.extend({ id: uuid });
export type NewProcess = z.infer<typeof createProcessSchema>;
export type ProcessUpdate = z.infer<typeof updateProcessSchema>;
export const processIdSchema = z.object({ id: uuid });

// ───────────── Organizational Checkup ─────────────

/** One answer (1–5) per statement, in the statements' order (lib/eos-checkup.ts). */
export const saveCheckupSchema = z.object({
  answers: z.array(z.number().int().min(1).max(5)).min(1).max(50),
  notes: z.string().max(2000).nullish(),
});
export const checkupIdSchema = z.object({ id: uuid });

// ───────────── Standard measurables (the portfolio template) ─────────────

/** A measurable as the portfolio template defines it — copied into a workspace by name. */
export interface StandardMeasurable {
  name: string;
  cadence: Cadence;
  unit: Unit;
  aggregation: Aggregation;
  goalOperator: GoalOperator | null;
  goalValue: number | null;
  goalValueMax: number | null;
}

// ───────────── Rows the pages receive ─────────────

export interface MeasurableRow {
  id: string;
  name: string;
  ownerPersonId: string | null;
  cadence: Cadence;
  goalOperator: GoalOperator | null;
  goalValue: number | null;
  goalValueMax: number | null;
  unit: Unit;
  aggregation: Aggregation;
  sortOrder: number;
}

export interface EntryRow {
  measurableId: string;
  periodStart: string;
  value: number;
}

export interface RockRow {
  id: string;
  quarter: string;
  title: string;
  ownerPersonId: string | null;
  dueDate: string | null;
  status: RockStatus;
  successCriteria: string | null;
  isCompany: boolean;
  oneYearGoalId: string | null;
}

/** An activity linked to a Rock — one of its milestones / to-dos. */
export interface RockActivity {
  id: string;
  rockId: string;
  subject: string;
  done: boolean;
  dueDate: string | Date | null;
}

export interface IssueRow {
  id: string;
  title: string;
  issueType: IssueType;
  rootCause: string | null;
  notes: string | null;
  horizon: IssueHorizon;
  status: "open" | "solved" | "dropped";
  outcome: IssueOutcome | null;
  rank: number | null;
  raisedByPersonId: string | null;
  ownerPersonId: string | null;
  measurableId: string | null;
  measurableName: string | null;
  rockId: string | null;
  rockTitle: string | null;
  solution: string | null;
  solvedAt: Date | string | null;
  createdAt: Date | string;
}

export interface TodoRow {
  id: string;
  subject: string;
  done: boolean;
  dueDate: Date | string | null;
  assignedToPersonId: string | null;
  updatedAt: Date | string;
}

export interface MeetingRow {
  id: string;
  heldAt: Date | string;
  averageRating: number | null;
  todosDone: number;
  todosTotal: number;
  issuesSolved: number;
  rocksOffTrack: number;
  measurablesOffGoal: number;
}

/** One concluded L10 with its details, for the history page. */
export interface MeetingHistoryRow extends MeetingRow {
  ratings: Record<string, number>;
  headlines: string | null;
  improvement: string | null;
  createdByUserId: string | null;
}

/** The L10 that is running right now: members rate it from their own devices until it is concluded. */
export interface LiveMeeting {
  id: string;
  startedAt: Date | string | null;
  ratings: Record<string, number>;
}

export interface L10Schedule {
  weekday: number;
  startTime: string;
  timezone: string;
}

export interface SeatRow {
  id: string;
  name: string;
  responsibilities: string[];
  parentSeatId: string | null;
  personId: string | null;
  sortOrder: number;
}

export interface ReviewRow {
  id: string;
  personId: string;
  quarter: string;
  kind: "manager" | "self";
  reviewerPersonId: string | null;
  valuesRatings: Record<string, string>;
  getsIt: boolean | null;
  wantsIt: boolean | null;
  capacity: boolean | null;
  notes: string | null;
  updatedAt: Date | string;
}

export interface ProcessRow {
  id: string;
  name: string;
  area: ProcessArea;
  ownerPersonId: string | null;
  steps: { title: string; detail?: string }[];
  stage: ProcessStage;
  lastReviewedAt: Date | string | null;
  updatedAt: Date | string;
}

export interface CheckupRow {
  id: string;
  takenAt: Date | string;
  answers: number[];
  score: number;
  notes: string | null;
}

/** A team person, as every owner picker shows them (id = the person's id, not a login). */
export interface TractionMember {
  id: string;
  name: string | null;
  email: string;
  /** Their seat(s) on the Accountability Chart, e.g. "Integrator, Operations". */
  seat?: string | null;
}

/** The numbers behind the Overview tiles and the Portfolio row. */
export interface TractionSummary {
  scorecard: { onGoal: number; offGoal: number; notEntered: number; total: number };
  rocks: { quarter: string; total: number; complete: number; onTrack: number; offTrack: number };
  /** Share of the last finished quarter's Rocks that were completed (EOS target: 80%+). Null with no Rocks. */
  lastQuarterRockRate: { quarter: string; rate: number } | null;
  openIssues: number;
  todos: { done: number; total: number };
  lastMeeting: MeetingRow | null;
  /** The Organizational Checkup: the kickoff (first) score and the latest one. Null before the first. */
  checkup: { kickoff: number; latest: number; count: number } | null;
}
