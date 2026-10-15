import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { notificationsService } from "@/modules/notifications/notifications.service";

/**
 * /api/cron/task-reminders — sends the push reminders for tasks whose due time has arrived, and the L10 reminders
 * (push + email, one hour before each workspace's standing meeting). Called every 20 minutes by cron-job.org
 * (.github/workflows/task-reminders.yml is the manual backup and explains the interval).
 * Not a Server Action: the caller has no session, it authenticates with a shared secret.
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Safe to call as often as you like — each reminder is claimed atomically, so it is sent once.
 */

function secretMatches(header: string | null, expected: string): boolean {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = Buffer.from(match[1].trim());
  const wanted = Buffer.from(expected);
  // Constant-time compare; lengths must match first or timingSafeEqual throws.
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

async function handle(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("/api/cron/task-reminders: CRON_SECRET is not set — the endpoint is disabled.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!secretMatches(request.headers.get("authorization"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // The L10 sweep sends email too, so it runs even when push (VAPID) isn't configured.
    const [tasks, l10] = await Promise.allSettled([notificationsService.sendDueTaskReminders(), notificationsService.sendDueL10Reminders()]);
    if (tasks.status === "rejected") console.error("/api/cron/task-reminders: task reminders failed:", tasks.reason);
    if (l10.status === "rejected") console.error("/api/cron/task-reminders: L10 reminders failed:", l10.reason);
    if (tasks.status === "rejected" && l10.status === "rejected") throw tasks.reason;
    return NextResponse.json({ ...(tasks.status === "fulfilled" ? tasks.value : {}), l10: l10.status === "fulfilled" ? l10.value : null });
  } catch (error) {
    console.error("/api/cron/task-reminders failed:", error);
    return NextResponse.json({ error: "Could not send reminders." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

export const dynamic = "force-dynamic";
