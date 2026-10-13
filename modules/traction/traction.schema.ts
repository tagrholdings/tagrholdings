import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, numeric, integer, date, jsonb, boolean, unique, foreignKey, check } from "drizzle-orm/pg-core";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";
import { teamPeopleTable } from "@/modules/team/team.schema";

/**
 * Traction — the EOS operating system every portfolio company runs (Scorecard, Rocks, Issues, L10 meetings, V/TO).
 * See .agents/docs/EOS_PLAN.md. Every table is tenant-owned: `tenant_id` + RLS + composite (tenant_id, x_id) FKs, like
 * the rest of the schema. Owners are team people (`*_person_id` → team_people), who may or may not have a login —
 * see modules/team.
 *
 * Enum-like columns are free text with a CHECK, mirroring the values in traction.types.ts.
 */

/** A Scorecard row: one number with an owner and a goal, entered every week or month. */
export const tractionMeasurablesTable = pgTable(
  "traction_measurables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    name: text("name").notNull(),
    ownerPersonId: uuid("owner_person_id"),
    /** Weekly is the EOS default ("monthly is too slow to react"); monthly stays for numbers that only exist monthly. */
    cadence: text("cadence").notNull().default("weekly"),
    /** gte / lte / eq / between. Null (with goal_value) = no goal yet: the cells stay neutral, never red or green. */
    goalOperator: text("goal_operator"),
    goalValue: numeric("goal_value", { mode: "number" }),
    /** The upper bound of a `between` goal (goal_value is the lower one). */
    goalValueMax: numeric("goal_value_max", { mode: "number" }),
    unit: text("unit").notNull().default("number"),
    /** How a quarter's periods roll up into the Quarter column: sum (revenue), average, latest (active customers). */
    aggregation: text("aggregation").notNull().default("sum"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("traction_measurables_tenant_id_id_unique").on(t.tenantId, t.id),
    check("traction_measurables_cadence_check", sql`${t.cadence} in ('weekly', 'monthly')`),
    check("traction_measurables_goal_operator_check", sql`${t.goalOperator} is null or ${t.goalOperator} in ('gte', 'lte', 'eq', 'between')`),
    foreignKey({
      name: "traction_measurables_owner_same_tenant_fk",
      columns: [t.tenantId, t.ownerPersonId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    check("traction_measurables_unit_check", sql`${t.unit} in ('number', 'currency', 'percent')`),
    check("traction_measurables_aggregation_check", sql`${t.aggregation} in ('sum', 'average', 'latest')`),
    tenantIsolationPolicy("traction_measurables"),
  ]
);

/** One Scorecard cell: a measurable's value for the week/month starting `period_start`. */
export const tractionEntriesTable = pgTable(
  "traction_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    measurableId: uuid("measurable_id").notNull(),
    /** Monday of the week, or the 1st of the month (see periodStartFor in traction.logic.ts). */
    periodStart: date("period_start", { mode: "string" }).notNull(),
    value: numeric("value", { mode: "number" }).notNull(),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("traction_entries_measurable_period_unique").on(t.measurableId, t.periodStart),
    foreignKey({
      name: "traction_entries_measurable_same_tenant_fk",
      columns: [t.tenantId, t.measurableId],
      foreignColumns: [tractionMeasurablesTable.tenantId, tractionMeasurablesTable.id],
    }).onDelete("cascade"),
    tenantIsolationPolicy("traction_entries"),
  ]
);

/** A 90-day priority. `quarter` is "2026-Q3". */
export const tractionRocksTable = pgTable(
  "traction_rocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    quarter: text("quarter").notNull(),
    title: text("title").notNull(),
    ownerPersonId: uuid("owner_person_id"),
    dueDate: date("due_date", { mode: "string" }),
    /** rolled_over = not done at quarter end and carried into the next quarter as a new Rock (done is binary in EOS). */
    status: text("status").notNull().default("on_track"),
    successCriteria: text("success_criteria"),
    /** Company Rock (the leadership team's) or an individual Rock of its owner. */
    isCompany: boolean("is_company").notNull().default(true),
    /** The 1-Year Plan goal this Rock moves (an id inside the V/TO's oneYear.goals). */
    oneYearGoalId: text("one_year_goal_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("traction_rocks_tenant_id_id_unique").on(t.tenantId, t.id),
    check("traction_rocks_quarter_check", sql`${t.quarter} ~ '^[0-9]{4}-Q[1-4]$'`),
    check("traction_rocks_status_check", sql`${t.status} in ('on_track', 'off_track', 'complete', 'dropped', 'rolled_over')`),
    foreignKey({
      name: "traction_rocks_owner_same_tenant_fk",
      columns: [t.tenantId, t.ownerPersonId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    tenantIsolationPolicy("traction_rocks"),
  ]
);

/**
 * The Issues List. `horizon`: short_term = the weekly L10's list, long_term = the V/TO's (worked at the quarterly).
 * An issue dropped from a red Scorecard cell or an off-track Rock remembers where it came from.
 */
export const tractionIssuesTable = pgTable(
  "traction_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    title: text("title").notNull(),
    notes: text("notes"),
    horizon: text("horizon").notNull().default("short_term"),
    status: text("status").notNull().default("open"),
    /** Lower comes first; the top 3 are what the next L10 solves. Null = unranked (after the ranked ones). */
    rank: integer("rank"),
    raisedByPersonId: uuid("raised_by_person_id"),
    ownerPersonId: uuid("owner_person_id"),
    /** problem → solve; idea → decide yes/no/later; obstacle → remove or escalate (IDS's three kinds). */
    issueType: text("issue_type").notNull().default("problem"),
    /** Identify: the real issue in one sentence — the root cause, not the symptom. */
    rootCause: text("root_cause"),
    /** How it was closed: yes/no/later (ideas), removed/escalated (obstacles), solved (problems). */
    outcome: text("outcome"),
    measurableId: uuid("measurable_id"),
    rockId: uuid("rock_id"),
    solution: text("solution"),
    solvedAt: timestamp("solved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("traction_issues_tenant_id_id_unique").on(t.tenantId, t.id),
    check("traction_issues_horizon_check", sql`${t.horizon} in ('short_term', 'long_term')`),
    check("traction_issues_status_check", sql`${t.status} in ('open', 'solved', 'dropped')`),
    check("traction_issues_type_check", sql`${t.issueType} in ('problem', 'idea', 'obstacle')`),
    check("traction_issues_outcome_check", sql`${t.outcome} is null or ${t.outcome} in ('solved', 'yes', 'no', 'later', 'removed', 'escalated')`),
    foreignKey({
      name: "traction_issues_owner_same_tenant_fk",
      columns: [t.tenantId, t.ownerPersonId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    foreignKey({
      name: "traction_issues_raised_by_same_tenant_fk",
      columns: [t.tenantId, t.raisedByPersonId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    foreignKey({
      name: "traction_issues_measurable_same_tenant_fk",
      columns: [t.tenantId, t.measurableId],
      foreignColumns: [tractionMeasurablesTable.tenantId, tractionMeasurablesTable.id],
    }),
    foreignKey({
      name: "traction_issues_rock_same_tenant_fk",
      columns: [t.tenantId, t.rockId],
      foreignColumns: [tractionRocksTable.tenantId, tractionRocksTable.id],
    }),
    tenantIsolationPolicy("traction_issues"),
  ]
);

/** A concluded L10. The numbers are a snapshot taken at Conclude, so later edits don't rewrite history. */
export const tractionMeetingsTable = pgTable(
  "traction_meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    heldAt: timestamp("held_at").notNull().defaultNow(),
    /** in_progress while the meeting runs (members rate from their own devices), concluded once recorded. */
    status: text("status").notNull().default("concluded"),
    startedAt: timestamp("started_at"),
    /** { [personId]: 1–10 } */
    ratings: jsonb("ratings").$type<Record<string, number>>().notNull(),
    averageRating: numeric("average_rating", { mode: "number" }),
    todosDone: integer("todos_done").notNull().default(0),
    todosTotal: integer("todos_total").notNull().default(0),
    issuesSolved: integer("issues_solved").notNull().default(0),
    rocksOffTrack: integer("rocks_off_track").notNull().default(0),
    measurablesOffGoal: integer("measurables_off_goal").notNull().default(0),
    headlines: text("headlines"),
    /** When the average is under 8: what would make the next one a 10. */
    improvement: text("improvement"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [check("traction_meetings_status_check", sql`${t.status} in ('in_progress', 'concluded')`), tenantIsolationPolicy("traction_meetings")]
);

/** The Vision/Traction Organizer — one document per workspace (shape: vtoContentSchema in traction.types.ts). */
export const tractionVtoTable = pgTable(
  "traction_vto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenantsTable.id),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    updatedByUserId: text("updated_by_user_id"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [tenantIsolationPolicy("traction_vto")]
);

/**
 * Accountability Chart seats. One person per seat (EOS: shared accountability is no accountability); a person may hold
 * several seats, and a person may have none. `parent_seat_id` builds the chart (the Integrator's seat under the
 * Visionary's, the department seats under the Integrator's…).
 */
export const tractionSeatsTable = pgTable(
  "traction_seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    name: text("name").notNull(),
    /** The seat's 3-5 roles ("LMA, P&L, special projects"). */
    responsibilities: jsonb("responsibilities").$type<string[]>().notNull().default([]),
    parentSeatId: uuid("parent_seat_id"),
    personId: uuid("person_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("traction_seats_tenant_id_id_unique").on(t.tenantId, t.id),
    foreignKey({
      name: "traction_seats_parent_same_tenant_fk",
      columns: [t.tenantId, t.parentSeatId],
      foreignColumns: [t.tenantId, t.id],
    }),
    foreignKey({
      name: "traction_seats_person_same_tenant_fk",
      columns: [t.tenantId, t.personId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    tenantIsolationPolicy("traction_seats"),
  ]
);

/**
 * People Analyzer — private. One row per person per quarter per kind: the manager's review (from the person's manager,
 * i.e. whoever holds the parent seat) and the person's self-review, compared in the Quarterly Conversation.
 * `values_ratings` is { [coreValue]: "+" | "+/-" | "-" }; GWC = Gets it, Wants it, Capacity to do it.
 */
export const tractionPeopleReviewsTable = pgTable(
  "traction_people_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    personId: uuid("person_id").notNull(),
    quarter: text("quarter").notNull(),
    kind: text("kind").notNull(),
    reviewerPersonId: uuid("reviewer_person_id"),
    valuesRatings: jsonb("values_ratings").$type<Record<string, string>>().notNull().default({}),
    getsIt: boolean("gets_it"),
    wantsIt: boolean("wants_it"),
    capacity: boolean("capacity"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("traction_people_reviews_person_quarter_kind_unique").on(t.tenantId, t.personId, t.quarter, t.kind),
    check("traction_people_reviews_kind_check", sql`${t.kind} in ('manager', 'self')`),
    check("traction_people_reviews_quarter_check", sql`${t.quarter} ~ '^[0-9]{4}-Q[1-4]$'`),
    foreignKey({
      name: "traction_people_reviews_person_same_tenant_fk",
      columns: [t.tenantId, t.personId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    foreignKey({
      name: "traction_people_reviews_reviewer_same_tenant_fk",
      columns: [t.tenantId, t.reviewerPersonId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    tenantIsolationPolicy("traction_people_reviews"),
  ]
);

/** A documented core process (EOS Process component): its named steps, owner, and whether it is Followed By All. */
export const tractionProcessesTable = pgTable(
  "traction_processes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    name: text("name").notNull(),
    /** Which core process this is: hr, sales, operations, customer_service, finance or other. */
    area: text("area").notNull().default("other"),
    ownerPersonId: uuid("owner_person_id"),
    /** [{ title, detail }] — the 5-20 major steps. */
    steps: jsonb("steps").$type<{ title: string; detail?: string }[]>().notNull().default([]),
    /** Documented → trained → followed by all. */
    stage: text("stage").notNull().default("documented"),
    lastReviewedAt: timestamp("last_reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("traction_processes_area_check", sql`${t.area} in ('hr', 'sales', 'operations', 'customer_service', 'finance', 'other')`),
    check("traction_processes_stage_check", sql`${t.stage} in ('documented', 'trained', 'followed')`),
    foreignKey({
      name: "traction_processes_owner_same_tenant_fk",
      columns: [t.tenantId, t.ownerPersonId],
      foreignColumns: [teamPeopleTable.tenantId, teamPeopleTable.id],
    }),
    tenantIsolationPolicy("traction_processes"),
  ]
);

/**
 * The L10's standing time: same day, same time, every week. `reminded_for` is the meeting start the 1-hour reminder
 * was last sent for, claimed atomically by the reminder sweep so it goes out once.
 */
export const tractionL10SettingsTable = pgTable(
  "traction_l10_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenantsTable.id),
    /** 0 = Sunday … 6 = Saturday. */
    weekday: integer("weekday").notNull(),
    /** "HH:MM", 24-hour, in `timezone`. */
    startTime: text("start_time").notNull(),
    timezone: text("timezone").notNull().default("America/Phoenix"),
    remindedFor: timestamp("reminded_for"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("traction_l10_settings_weekday_check", sql`${t.weekday} between 0 and 6`),
    check("traction_l10_settings_time_check", sql`${t.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    tenantIsolationPolicy("traction_l10_settings"),
  ]
);

/**
 * The EOS Organizational Checkup: 20 statements scored 1–5 (lib/eos-checkup.ts). Taken at kickoff and again later
 * (the playbook asks for month 12) to measure movement. `answers` follows the statements' order; `score` is the
 * 0–100 percentage, stored so history never shifts if the statements are ever reworded.
 */
export const tractionCheckupsTable = pgTable(
  "traction_checkups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    takenAt: timestamp("taken_at").notNull().defaultNow(),
    takenByUserId: text("taken_by_user_id"),
    answers: jsonb("answers").$type<number[]>().notNull(),
    score: integer("score").notNull(),
    notes: text("notes"),
  },
  (t) => [check("traction_checkups_score_check", sql`${t.score} between 0 and 100`), tenantIsolationPolicy("traction_checkups")]
);
