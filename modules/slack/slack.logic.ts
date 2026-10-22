import { zonedTimeToUtc } from "@/modules/traction/traction.logic";
import { toZonedInputValues } from "@/utils/date";
import type { ActivityRow } from "@/modules/activities/activities.types";
import type { ProposalFields } from "./slack.types";

/** Lowercase, accents and punctuation removed — "João da Padaria, Ltda." matches "joao padaria". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface Match<T> {
  item: T;
  score: number;
}

/** A tool argument as trimmed text, or undefined when it is missing, blank or not text. */
export const str = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** Edit distance with swaps of neighbours counted as one slip ("pereria" → "pereira" is 1); gives up past `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/** How many letters of slack a word of this length gets: none for short ones (they'd match anything), more for long. */
const typoTolerance = (length: number) => (length <= 3 ? 0 : length <= 6 ? 1 : 2);

/**
 * How well one word of the query is found among a text's words: 1 for the word itself, a little less for a longer word
 * that starts with it (an unfinished name), for a hit inside a word, and for a word that is a few letters off.
 */
function wordScore(word: string, tokens: string[]): number {
  let best = 0;
  for (const token of tokens) {
    if (token === word) return 1;
    if (word.length >= 2 && token.startsWith(word)) best = Math.max(best, 0.9);
    else if (word.length >= 3 && token.includes(word)) best = Math.max(best, 0.8);
    const tolerance = typoTolerance(word.length);
    if (tolerance === 0) continue;
    if (editDistance(word, token, tolerance) <= tolerance) best = Math.max(best, 0.75);
    // An unfinished AND misspelled name: compare with the start of the longer word.
    else if (token.length > word.length && editDistance(word, token.slice(0, word.length), tolerance) <= tolerance) best = Math.max(best, 0.6);
  }
  return best;
}

/**
 * Fuzzy name search over a list already in memory (the services have no text search, and a workspace's lists are small).
 * Forgiving on purpose: accents and case don't matter, a name may be unfinished ("joao per") or a few letters off
 * ("pereria"). Every word of the query is looked for in each of an item's texts; the score is the average over the
 * query's words, with a bonus for an exact or prefix hit on the whole text. Below 0.5 is not a match.
 */
export function searchByText<T>(items: T[], query: string, textsOf: (item: T) => (string | null | undefined)[], limit = 5): Match<T>[] {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const whole = words.join(" ");
  const matches: Match<T>[] = [];
  for (const item of items) {
    let best = 0;
    for (const text of textsOf(item).filter((t): t is string => !!t).map(normalizeText)) {
      const tokens = text.split(" ").filter(Boolean);
      const average = words.reduce((sum, w) => sum + wordScore(w, tokens), 0) / words.length;
      if (average < 0.5) continue;
      const bonus = text === whole ? 0.5 : text.startsWith(whole) ? 0.25 : 0;
      best = Math.max(best, average + bonus);
    }
    if (best >= 0.5) matches.push({ item, score: best });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** A stage of a board named by id ("in_discussion") or by what people call it ("in discussion", "discusion"). */
export function resolveStage(columns: { id: string; label: string }[], input: string): { id: string; label: string } | null {
  const exact = columns.find((c) => c.id === input) ?? columns.find((c) => normalizeText(c.label) === normalizeText(input));
  if (exact) return exact;
  const [best, second] = searchByText(columns, input, (c) => [c.label, c.id], 2);
  // Stricter than a name search: a stage is picked from a handful, so half a match ("in" out of "in discussion" hitting
  // "In progress") would move a card somewhere wrong. Ambiguous is no match too — the model is told the options instead.
  return best && best.score >= 0.7 && (!second || best.score > second.score) ? best.item : null;
}

/** The calendar day ("2026-10-23") an activity is due, as the person who is asking reads it: the zone it was entered in, else theirs. */
export function dueDay(dueDate: Date | string, activityTimeZone: string | null | undefined, personTimeZone: string): string {
  return toZonedInputValues(dueDate, activityTimeZone ?? personTimeZone).date;
}

/** `iso` ("2026-10-23") plus `days` calendar days. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface DueFilter {
  /** Named windows, relative to the person's today. */
  window?: "overdue" | "today" | "tomorrow" | "this_week" | "any";
  /** One specific day. */
  on?: string;
  /** An inclusive range; either end may be open. */
  from?: string;
  to?: string;
}

/**
 * Whether an activity's due day passes a filter. Everything is compared as calendar days in the person's own zone —
 * "today" is THEIR today, not the server's. An activity with no due date only passes `any` (or no filter).
 */
export function matchesDue(day: string | null, today: string, filter: DueFilter): boolean {
  const { window = "any", on, from, to } = filter;
  const hasRange = !!(on || from || to);
  if (!hasRange && window === "any") return true;
  if (!day) return false;
  if (on) return day === on;
  if (from || to) return (!from || day >= from) && (!to || day <= to);
  switch (window) {
    case "overdue":
      return day < today;
    case "today":
      return day === today;
    case "tomorrow":
      return day === addDays(today, 1);
    case "this_week":
      return day >= today && day <= addDays(today, 7);
    default:
      return true;
  }
}

/** A Slack message as plain text: a card's blocks flattened (its fields are what a later "change it" refers to), mrkdwn stars dropped. */
export function slackMessageText(message: { text?: string; blocks?: unknown[] }): string {
  const lines: string[] = [];
  for (const block of (message.blocks ?? []) as { type?: string; text?: { text?: string }; fields?: { text?: string }[] }[]) {
    if (block.type !== "section") continue;
    if (block.text?.text) lines.push(block.text.text);
    for (const field of block.fields ?? []) if (field.text) lines.push(field.text.replace(/\n/g, ": "));
  }
  return (lines.length > 0 ? lines.join("\n") : (message.text ?? "")).replace(/\*/g, "").trim();
}

/** The activity ids a thread's cards linked to ("…?activity=<id>") — what "move it to Friday" points at. */
export function activityIdsIn(texts: string[]): string[] {
  const ids = new Set<string>();
  for (const text of texts) for (const m of text.matchAll(/activity=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)) ids.add(m[1].toLowerCase());
  return [...ids];
}

/**
 * "2026-10-23" + optional "14:00", as the person said them → the instant and the zone to store. The model never does
 * time-zone math: it gives the wall clock and this turns it into an instant in the person's zone.
 *
 * Like the activity form, a date with no time is stored as local midnight with NO zone (it shows as a date only); a date
 * with a time keeps the zone it was entered in. Null for anything that isn't a date.
 */
export function buildDue(date: string | null | undefined, time: string | null | undefined, timeZone: string): { dueDate: string; timezone: string | null } | null {
  const d = date?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!d) return null;
  const t = time?.trim() ? time.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/) : null;
  if (time?.trim() && !t) return null;
  const instant = zonedTimeToUtc(Number(d[1]), Number(d[2]), Number(d[3]), t ? Number(t[1]) : 0, t ? Number(t[2]) : 0, timeZone);
  // Midnight with a time is a real time (12:00 AM); only "no time" means date-only.
  return { dueDate: instant.toISOString(), timezone: t ? timeZone : null };
}

/** The editable fields of an existing activity, in the shape a proposal carries — the starting point of a merge. */
export function fieldsFromRow(row: ActivityRow): ProposalFields {
  return {
    type: row.type as ProposalFields["type"],
    subject: row.subject,
    dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
    timezone: row.timezone,
    priority: row.priority as ProposalFields["priority"],
    notes: row.notes,
    contactId: row.contactId,
    organizationId: row.organizationId,
    pipelineItemId: row.pipelineItemId,
    assignedToPersonId: row.assignedToPersonId,
    assignedToContactId: row.assignedToContactId,
    rockId: row.rockId,
    notify: row.notify,
  };
}

/**
 * An edit changes only what the person said. `undefined` keeps the current value, `null` clears it — the update
 * itself replaces every field (updateActivitySchema), so the merge is done here. Assigning to a person clears a contact
 * assignee and vice versa (the two are mutually exclusive); a reminder needs a due date, so clearing the date turns it off.
 */
export function mergeFields(current: ProposalFields, patch: Partial<ProposalFields>): ProposalFields {
  const merged: ProposalFields = { ...current };
  for (const [key, value] of Object.entries(patch) as [keyof ProposalFields, unknown][]) {
    if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }
  if (patch.assignedToPersonId) merged.assignedToContactId = null;
  else if (patch.assignedToContactId) merged.assignedToPersonId = null;
  if (!merged.dueDate) {
    merged.notify = false;
    merged.timezone = null;
  }
  return merged;
}
