/** The most a `notes` column holds (the zod schemas of pipeline items and organizations enforce the same). */
export const MAX_NOTES_CHARS = 10_000;

/**
 * One dated line to append to a record's notes: "[2026-10-22 · Matheus] Talked to João, wants to close at 2M".
 * `date` is already the calendar day the person lives on ("YYYY-MM-DD") — the caller knows their time zone.
 */
export function formatNoteEntry(text: string, author: string | null, date: string): string {
  const who = author?.trim();
  return `[${date}${who ? ` · ${who}` : ""}] ${text.trim()}`;
}
