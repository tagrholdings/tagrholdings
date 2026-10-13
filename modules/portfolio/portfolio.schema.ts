import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, numeric, integer, check } from "drizzle-orm/pg-core";

/**
 * The portfolio's standard Scorecard: the measurables the owner wants from EVERY company (revenue, P&L, new customers,
 * active customers, aging AR…), so the Portfolio page can compare them side by side. Platform-level, like
 * platform_roles: no tenant_id, no RLS, written only by the super admin. Applying it to a workspace copies each row
 * in as that workspace's own measurable (matched by name), which the company then owns and sets an owner for.
 */
export const portfolioScorecardTemplateTable = pgTable(
  "portfolio_scorecard_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    cadence: text("cadence").notNull().default("weekly"),
    unit: text("unit").notNull().default("number"),
    aggregation: text("aggregation").notNull().default("sum"),
    /** A suggested goal — each company can change its own copy. */
    goalOperator: text("goal_operator"),
    goalValue: numeric("goal_value", { mode: "number" }),
    goalValueMax: numeric("goal_value_max", { mode: "number" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("portfolio_scorecard_template_cadence_check", sql`${t.cadence} in ('weekly', 'monthly')`),
    check("portfolio_scorecard_template_unit_check", sql`${t.unit} in ('number', 'currency', 'percent')`),
    check("portfolio_scorecard_template_aggregation_check", sql`${t.aggregation} in ('sum', 'average', 'latest')`),
    check("portfolio_scorecard_template_goal_operator_check", sql`${t.goalOperator} is null or ${t.goalOperator} in ('gte', 'lte', 'eq', 'between')`),
  ]
);
