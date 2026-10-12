/**
 * Pure Traction rules — quarters, Scorecard periods, goals and roll-ups. No imports, so the Service, the pages and the
 * client components (a cell's colour, the Quarter column) all compute the same answer. Dates are "YYYY-MM-DD" strings
 * worked in UTC, so a period never shifts with the viewer's timezone.
 */

export type Cadence = "weekly" | "monthly";
export type GoalOperator = "gte" | "lte" | "eq";
export type Unit = "number" | "currency" | "percent";
export type Aggregation = "sum" | "average" | "latest";

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fromIso = (iso: string) => new Date(`${iso}T00:00:00Z`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Today as "YYYY-MM-DD", in UTC. */
export function todayIso(now: Date = new Date()): string {
  return toIso(now);
}

// ───────────── Quarters ("2026-Q3") ─────────────

export function quarterOf(iso: string): string {
  const d = fromIso(iso);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export function isQuarter(value: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(value);
}

export function parseQuarter(quarter: string): { year: number; q: number } {
  const [year, q] = quarter.split("-Q").map(Number);
  return { year, q };
}

/** First and last day of the quarter. */
export function quarterRange(quarter: string): { start: string; end: string } {
  const { year, q } = parseQuarter(quarter);
  const start = new Date(Date.UTC(year, (q - 1) * 3, 1));
  const end = new Date(Date.UTC(year, q * 3, 0));
  return { start: toIso(start), end: toIso(end) };
}

export function shiftQuarter(quarter: string, by: number): string {
  const { year, q } = parseQuarter(quarter);
  const index = year * 4 + (q - 1) + by;
  return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`;
}

/** "2026-Q3" → "Q3 2026". */
export function quarterLabel(quarter: string): string {
  const { year, q } = parseQuarter(quarter);
  return `Q${q} ${year}`;
}

// ───────────── Scorecard periods ─────────────

/** The period a day falls in: the Monday of its week, or the 1st of its month. */
export function periodStartFor(iso: string, cadence: Cadence): string {
  const d = fromIso(iso);
  if (cadence === "monthly") return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const offset = (d.getUTCDay() + 6) % 7; // days since Monday
  return toIso(new Date(d.getTime() - offset * 86_400_000));
}

export function shiftPeriod(period: string, cadence: Cadence, by: number): string {
  const d = fromIso(period);
  if (cadence === "monthly") return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + by, 1)));
  return toIso(new Date(d.getTime() + by * 7 * 86_400_000));
}

/** How many columns the grid shows: a quarter of weeks, or half a year of months. */
export const WINDOW_SIZE: Record<Cadence, number> = { weekly: 13, monthly: 6 };

/** The `count` periods ending with the one that contains `endIso`, oldest first. */
export function periodWindow(endIso: string, cadence: Cadence, count: number = WINDOW_SIZE[cadence]): string[] {
  const last = periodStartFor(endIso, cadence);
  return Array.from({ length: count }, (_, i) => shiftPeriod(last, cadence, i - (count - 1)));
}

/** "2026-07-01" → "Jul" (monthly) / "Jul 6" (weekly). The year is added when it isn't the current one. */
export function periodLabel(period: string, cadence: Cadence, currentYear?: number): string {
  const d = fromIso(period);
  const month = MONTHS[d.getUTCMonth()];
  const base = cadence === "monthly" ? month : `${month} ${d.getUTCDate()}`;
  return currentYear !== undefined && d.getUTCFullYear() !== currentYear ? `${base} ’${String(d.getUTCFullYear()).slice(2)}` : base;
}

// ───────────── Goals and roll-ups ─────────────

export interface GoalRule {
  goalOperator: GoalOperator | null;
  goalValue: number | null;
}

/** true = on goal, false = off goal (red), null = no goal set or no value — the cell stays neutral. */
export function goalMet(rule: GoalRule, value: number | null | undefined): boolean | null {
  if (value === null || value === undefined || rule.goalOperator === null || rule.goalValue === null) return null;
  if (rule.goalOperator === "gte") return value >= rule.goalValue;
  if (rule.goalOperator === "lte") return value <= rule.goalValue;
  return value === rule.goalValue;
}

/** Rolls a quarter's values (oldest first, gaps skipped) into one number. Null when nothing was entered. */
export function aggregate(values: (number | null | undefined)[], aggregation: Aggregation): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  if (aggregation === "latest") return present[present.length - 1];
  const sum = present.reduce((a, b) => a + b, 0);
  return aggregation === "sum" ? sum : sum / present.length;
}

export const GOAL_SYMBOL: Record<GoalOperator, string> = { gte: "≥", lte: "≤", eq: "=" };

export function formatValue(value: number | null | undefined, unit: Unit): string {
  if (value === null || value === undefined) return "";
  const decimals = Number.isInteger(value) ? 0 : 2;
  const number = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
  if (unit === "currency") return `$${number}`;
  if (unit === "percent") return `${number}%`;
  return number;
}

export function formatGoal(rule: GoalRule, unit: Unit): string | null {
  if (rule.goalOperator === null || rule.goalValue === null) return null;
  return `${GOAL_SYMBOL[rule.goalOperator]} ${formatValue(rule.goalValue, unit)}`;
}

/** The latest period that has a value, and that value — what the Overview and the L10 call "this week's number". */
export function latestEntry(entries: { periodStart: string; value: number }[]): { periodStart: string; value: number } | null {
  return entries.reduce<{ periodStart: string; value: number } | null>((latest, e) => (!latest || e.periodStart > latest.periodStart ? e : latest), null);
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
