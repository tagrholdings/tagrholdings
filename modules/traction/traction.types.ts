import { z } from "zod";
import type { Aggregation, Cadence, GoalOperator, Unit } from "./traction.logic";

export const CADENCES = ["weekly", "monthly"] as const;
export const GOAL_OPERATORS = ["gte", "lte", "eq"] as const;
export const UNITS = ["number", "currency", "percent"] as const;
export const AGGREGATIONS = ["sum", "average", "latest"] as const;
export const ROCK_STATUSES = ["on_track", "off_track", "complete", "dropped"] as const;
export const ISSUE_HORIZONS = ["short_term", "long_term"] as const;

export type RockStatus = (typeof ROCK_STATUSES)[number];
export type IssueHorizon = (typeof ISSUE_HORIZONS)[number];

export const ROCK_STATUS_LABELS: Record<RockStatus, string> = {
  on_track: "On track",
  off_track: "Off track",
  complete: "Complete",
  dropped: "Dropped",
};
export const UNIT_LABELS: Record<Unit, string> = { number: "Number", currency: "Dollars", percent: "Percent" };
export const AGGREGATION_LABELS: Record<Aggregation, string> = { sum: "Total", average: "Average", latest: "Latest" };
export const CADENCE_LABELS: Record<Cadence, string> = { weekly: "Weekly", monthly: "Monthly" };

const uuid = z.uuid();
const ownerId = z.string().max(100).nullish();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-06-30.");
const quarter = z.string().regex(/^\d{4}-Q[1-4]$/, "Use a quarter like 2026-Q3.");

// ───────────── Scorecard ─────────────

const measurableFields = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  ownerUserId: ownerId,
  cadence: z.enum(CADENCES),
  unit: z.enum(UNITS),
  aggregation: z.enum(AGGREGATIONS),
  goalOperator: z.enum(GOAL_OPERATORS).nullish(),
  goalValue: z.number().finite().nullish(),
});
const goalIsComplete = (m: { goalOperator?: string | null; goalValue?: number | null }) => (m.goalOperator == null) === (m.goalValue == null);
const goalMessage = { message: "Set both the comparison and the goal number, or neither.", path: ["goalValue"] };

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
  ownerUserId: ownerId,
  dueDate: isoDate.nullish(),
  successCriteria: z.string().max(2000).nullish(),
  status: z.enum(ROCK_STATUSES),
});
export const createRockSchema = rockFieldsSchema;
export const updateRockSchema = rockFieldsSchema.extend({ id: uuid });
export const setRockStatusSchema = z.object({ id: uuid, status: z.enum(ROCK_STATUSES) });
export const deleteRockSchema = z.object({ id: uuid });
export type NewRock = z.infer<typeof createRockSchema>;
export type RockUpdate = z.infer<typeof updateRockSchema>;

// ───────────── Issues ─────────────

export const createIssueSchema = z.object({
  title: z.string().trim().min(1, "Describe the issue.").max(200),
  notes: z.string().max(5000).nullish(),
  horizon: z.enum(ISSUE_HORIZONS),
  ownerUserId: ownerId,
  measurableId: uuid.nullish(),
  rockId: uuid.nullish(),
});
export type NewIssue = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1, "Describe the issue.").max(200),
  notes: z.string().max(5000).nullish(),
  horizon: z.enum(ISSUE_HORIZONS),
  ownerUserId: ownerId,
});
export type IssueUpdate = z.infer<typeof updateIssueSchema>;

/** Solving an issue usually creates the To-Do that carries the solution out. */
export const solveIssueSchema = z.object({
  id: uuid,
  solution: z.string().max(2000).nullish(),
  todo: z
    .object({
      subject: z.string().trim().min(1, "Write the To-Do.").max(200),
      assignedToUserId: ownerId,
      dueDate: z.date().nullish(),
    })
    .nullish(),
});
export type SolveIssueInput = z.infer<typeof solveIssueSchema>;

export const issueIdSchema = z.object({ id: uuid });
/** The open issues of one list in their new order (first = rank 1). */
export const reorderIssuesSchema = z.object({ ids: z.array(uuid).max(200) });

// ───────────── L10 meeting ─────────────

export const concludeMeetingSchema = z.object({
  ratings: z.record(z.string().max(100), z.number().int().min(1).max(10)),
  headlines: z.string().max(5000).nullish(),
});
export type ConcludeMeetingInput = z.infer<typeof concludeMeetingSchema>;

/** New L10 To-Do created inside the meeting (always an `l10Todo` task). */
export const createTodoSchema = z.object({
  subject: z.string().trim().min(1, "Write the To-Do.").max(200),
  assignedToUserId: ownerId,
  dueDate: z.date().nullish(),
});
export type NewTodo = z.infer<typeof createTodoSchema>;

// ───────────── V/TO ─────────────

const line = z.string().max(500);
const lines = z.array(line).max(30);

export const vtoContentSchema = z.object({
  coreValues: lines.default([]),
  purpose: line.default(""),
  niche: line.default(""),
  tenYear: z.object({ date: line.default(""), revenue: line.default(""), picture: line.default("") }).default({ date: "", revenue: "", picture: "" }),
  marketing: z
    .object({ targetMarket: line.default(""), uniques: lines.default([]), provenProcess: line.default(""), guarantee: line.default("") })
    .default({ targetMarket: "", uniques: [], provenProcess: "", guarantee: "" }),
  threeYear: z
    .object({ date: line.default(""), revenue: line.default(""), profit: line.default(""), measurables: line.default(""), picture: lines.default([]) })
    .default({ date: "", revenue: "", profit: "", measurables: "", picture: [] }),
  oneYear: z
    .object({ date: line.default(""), revenue: line.default(""), profit: line.default(""), measurables: line.default(""), goals: lines.default([]) })
    .default({ date: "", revenue: "", profit: "", measurables: "", goals: [] }),
});
export type VtoContent = z.infer<typeof vtoContentSchema>;
export const saveVtoSchema = z.object({ content: vtoContentSchema });

// ───────────── Rows the pages receive ─────────────

export interface MeasurableRow {
  id: string;
  name: string;
  ownerUserId: string | null;
  cadence: Cadence;
  goalOperator: GoalOperator | null;
  goalValue: number | null;
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
  ownerUserId: string | null;
  dueDate: string | null;
  status: RockStatus;
  successCriteria: string | null;
}

export interface IssueRow {
  id: string;
  title: string;
  notes: string | null;
  horizon: IssueHorizon;
  status: "open" | "solved" | "dropped";
  rank: number | null;
  raisedByUserId: string | null;
  ownerUserId: string | null;
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
  assignedToUserId: string | null;
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

/** A workspace member, as every owner picker shows them. */
export interface TractionMember {
  id: string;
  name: string | null;
  email: string;
}

/** The numbers behind the Overview tiles and the Portfolio row. */
export interface TractionSummary {
  scorecard: { onGoal: number; offGoal: number; notEntered: number; total: number };
  rocks: { quarter: string; total: number; complete: number; onTrack: number; offTrack: number };
  openIssues: number;
  todos: { done: number; total: number };
  lastMeeting: MeetingRow | null;
}
