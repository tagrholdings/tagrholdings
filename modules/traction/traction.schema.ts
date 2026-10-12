import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, numeric, integer, date, jsonb, unique, foreignKey, check } from "drizzle-orm/pg-core";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";

/**
 * Traction — the EOS operating system every portfolio company runs (Scorecard, Rocks, Issues, L10 meetings, V/TO).
 * See .agents/docs/EOS_PLAN.md. Every table is tenant-owned: `tenant_id` + RLS + composite (tenant_id, x_id) FKs, like
 * the rest of the schema. Owners (`*_user_id`) are Neon Auth user ids — no FK possible, so tractionService checks
 * workspace membership instead (same as activities.assigned_to_user_id).
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
    ownerUserId: text("owner_user_id"),
    cadence: text("cadence").notNull().default("monthly"),
    /** gte / lte / eq. Null (with goal_value) = no goal yet: the cells stay neutral, never red or green. */
    goalOperator: text("goal_operator"),
    goalValue: numeric("goal_value", { mode: "number" }),
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
    check("traction_measurables_goal_operator_check", sql`${t.goalOperator} is null or ${t.goalOperator} in ('gte', 'lte', 'eq')`),
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
    ownerUserId: text("owner_user_id"),
    dueDate: date("due_date", { mode: "string" }),
    status: text("status").notNull().default("on_track"),
    successCriteria: text("success_criteria"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("traction_rocks_tenant_id_id_unique").on(t.tenantId, t.id),
    check("traction_rocks_quarter_check", sql`${t.quarter} ~ '^[0-9]{4}-Q[1-4]$'`),
    check("traction_rocks_status_check", sql`${t.status} in ('on_track', 'off_track', 'complete', 'dropped')`),
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
    raisedByUserId: text("raised_by_user_id"),
    ownerUserId: text("owner_user_id"),
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
    /** { [userId]: 1–10 } */
    ratings: jsonb("ratings").$type<Record<string, number>>().notNull(),
    averageRating: numeric("average_rating", { mode: "number" }),
    todosDone: integer("todos_done").notNull().default(0),
    todosTotal: integer("todos_total").notNull().default(0),
    issuesSolved: integer("issues_solved").notNull().default(0),
    rocksOffTrack: integer("rocks_off_track").notNull().default(0),
    measurablesOffGoal: integer("measurables_off_goal").notNull().default(0),
    headlines: text("headlines"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [tenantIsolationPolicy("traction_meetings")]
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
