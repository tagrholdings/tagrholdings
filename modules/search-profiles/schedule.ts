/**
 * When a search profile will next actually run.
 *
 * A profile's own frequency only says when it becomes *due*; the engine never wakes on its own —
 * GitHub Actions starts it on a fixed cron, and it then runs whatever is due. So the real next run
 * is the first cron tick at or after the due time. Keep ENGINE_TICK_HOURS in step with the `cron`
 * line in .github/workflows/lead-engine.yml.
 *
 * Pure (takes `now`) so it's testable and safe to call during render.
 */
export const ENGINE_TICK_HOURS = 6;

const HOUR_MS = 3_600_000;

export interface ScheduleInput {
  frequencyHours: number;
  lastRunAt: Date | string | null;
  /** A "Run now" the engine hasn't picked up yet — due immediately. */
  runRequestedAt: Date | string | null;
}

/** Epoch ms of the next engine tick that will pick this profile up. Ticks fall on UTC hours divisible by ENGINE_TICK_HOURS. */
export function nextEngineRunAt(profile: ScheduleInput, now: number): number {
  const tick = ENGINE_TICK_HOURS * HOUR_MS;
  const dueAt =
    profile.runRequestedAt || !profile.lastRunAt ? now : new Date(profile.lastRunAt).getTime() + profile.frequencyHours * HOUR_MS;
  return Math.ceil(Math.max(dueAt, now) / tick) * tick;
}

/** "3d 4h", "2h 14m", "14m 03s", "42s" — coarse when far away, second-by-second when close. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
