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

/**
 * The quarters Rocks can be planned in: all four of the current year, plus as many of the next year as the current
 * quarter's number (Q1 → Q1 next year; Q3 → Q1–Q3 next year), so there are always four quarters ahead. Any other
 * quarter in `alsoInclude` (one that already has Rocks) is kept, so history never disappears. Oldest first.
 */
export function planningQuarters(currentQuarter: string, alsoInclude: string[] = []): string[] {
  const { year, q } = parseQuarter(currentQuarter);
  const window = [1, 2, 3, 4].map((n) => `${year}-Q${n}`).concat(Array.from({ length: q }, (_, i) => `${year + 1}-Q${i + 1}`));
  return [...new Set([...window, ...alsoInclude.filter(isQuarter)])].sort();
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

// ───────────── People and V/TO values ─────────────

/** A member's display name (name, else email), or null when the id is empty or not a member. */
export function memberName(members: { id: string; name: string | null; email: string }[], userId: string | null | undefined): string | null {
  if (!userId) return null;
  const member = members.find((m) => m.id === userId);
  return member ? member.name || member.email : null;
}

/** "$3M", "$600K", "$1.5M" — the V/TO's revenue/profit, written the way people say them. */
export function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const abs = Math.abs(value);
  const [divisor, suffix] = abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : abs >= 1e3 ? [1e3, "K"] : [1, ""];
  const scaled = Math.round((value / divisor) * 100) / 100;
  return `$${scaled.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
}

/** "$3M" / "600K" / "1,250,000" / 2500000 → a number; anything else (or empty) → null. */
export function parseMoney(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const match = input.trim().replace(/[$,\s]/g, "").match(/^(-?\d+(?:\.\d+)?)([kmb])?$/i);
  if (!match) return null;
  const multiplier = { k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase() as "k" | "m" | "b"] ?? 1;
  return Number(match[1]) * multiplier;
}

/** A calendar date as "YYYY-MM-DD": kept when already ISO, parsed from text like "Jan 30, 2036", else "". */
export function parseCalendarDate(input: unknown): string {
  if (typeof input !== "string" || input.trim() === "") return "";
  const value = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

/** "2036-01-30" → "Jan 30, 2036". */
export function formatCalendarDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = fromIso(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
