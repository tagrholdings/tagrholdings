import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { notificationsService } from "@/modules/notifications/notifications.service";

/**
 * /api/cron/task-reminders — sends the push reminders for tasks whose due time has arrived. Called every few
 * minutes by a scheduler (.github/workflows/task-reminders.yml; a Vercel Cron job works too, it sends the
 * same header). Not a Server Action: the caller has no session, it authenticates with a shared secret.
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
    return NextResponse.json(await notificationsService.sendDueTaskReminders());
  } catch (error) {
    console.error("/api/cron/task-reminders failed:", error);
    return NextResponse.json({ error: "Could not send reminders." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

export const dynamic = "force-dynamic";
