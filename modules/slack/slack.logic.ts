import { zonedTimeToUtc } from "@/modules/traction/traction.logic";
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

/**
 * Fuzzy name search over a list already in memory (the services have no text search, and a workspace's lists are small).
 * Every word of the query is looked for in the item's texts; the score is the share of words found, with a bonus for
 * an exact or prefix hit. Below half the words found is not a match.
 */
export function searchByText<T>(items: T[], query: string, textsOf: (item: T) => (string | null | undefined)[], limit = 5): Match<T>[] {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const matches: Match<T>[] = [];
  for (const item of items) {
    const texts = textsOf(item).filter((t): t is string => !!t).map(normalizeText);
    let best = 0;
    for (const text of texts) {
      const found = words.filter((w) => text.includes(w)).length / words.length;
      if (found === 0) continue;
      const bonus = text === words.join(" ") ? 0.5 : text.startsWith(words.join(" ")) ? 0.25 : 0;
      best = Math.max(best, found + bonus);
    }
    if (best >= 0.5) matches.push({ item, score: best });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
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
