const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface WeekDay {
  date: Date;
  /** "MON", "TUE", ... */
  label: string;
  dayNumber: number;
  isToday: boolean;
}

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * Monday–Sunday of the week containing `now`, shifted by `weekOffset` weeks
 * (-1 = last week, 1 = next week) — powers the /activities week board.
 * Days are built with the local-date constructor, not `+ n * DAY_MS`, so a
 * DST change mid-week can't shift a day off midnight.
 */
export function getCurrentWeekDays(now = new Date(), weekOffset = 0): WeekDay[] {
  const today = startOfDay(now);
  // JS getDay(): 0=Sun..6=Sat. Convert to a Monday-first offset (0=Mon..6=Sun).
  const mondayOffset = (today.getDay() + 6) % 7;

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset + weekOffset * 7 + i);
    return { date, label: WEEKDAY_LABELS[i], dayNumber: date.getDate(), isToday: isSameDay(date, today) };
  });
}

export function isSameDate(a: Date | string, b: Date) {
  return isSameDay(new Date(a), b);
}

/**
 * Combines a `<input type="date">` value ("yyyy-mm-dd") and an optional
 * `<input type="time">` value ("HH:mm") into a real local-time `Date`.
 *
 * The bug this fixes: `new Date("2026-09-18")` parses as **UTC midnight**,
 * not local midnight — anyone west of UTC (all of the US) then sees it
 * render as the 17th once formatted in local time. `new Date(y, m, d, ...)`,
 * the constructor used here, always builds a Date in the local timezone, so
 * the calendar day picked in the input is the calendar day stored.
 */
export function parseLocalDateTime(dateValue: string, timeValue?: string): Date {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (timeValue) {
    const [hours, minutes] = timeValue.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }
  return new Date(year, month - 1, day);
}

/** Inverse of parseLocalDateTime's date half — for pre-filling a date input from a stored Date. */
export function toDateInputValue(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Inverse of parseLocalDateTime's time half — for pre-filling a time input from a stored Date. */
export function toTimeInputValue(date: Date | string): string {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** true if `date` carries a real time-of-day (not exactly local midnight) — i.e. a time was set. */
export function hasTimeComponent(date: Date | string): boolean {
  const d = new Date(date);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** Always `"en-US"` regardless of server/runtime locale — this app is US-based, per design.md. */
export function formatDateUS(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(
    "en-US",
    opts ?? { month: "short", day: "numeric", year: "numeric" }
  );
}

export function formatDateTimeUS(date: Date | string): string {
  const d = new Date(date);
  const datePart = formatDateUS(d, { weekday: "long", month: "short", day: "numeric" });
  return hasTimeComponent(d) ? `${datePart}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : datePart;
}

export type DueBucket = "overdue" | "today" | "tomorrow" | "this_week" | "later" | "none";

/** Buckets a due date relative to now — powers the Activities quick filters. */
export function dueBucket(dueDate: Date | string | null, now = new Date()): DueBucket {
  if (!dueDate) return "none";
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(now);
  const diffDays = Math.round((due.getTime() - today.getTime()) / DAY_MS);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return "this_week";
  return "later";
}
