import { NextResponse } from "next/server";

/**
 * GET /api/version — which deployment is live right now (the commit it was built from). The installed app polls
 * this to tell whether it is running an older version (Settings → Application). Public on purpose: it returns
 * nothing but an opaque build id, and never cached, or the answer would always be the old one.
 */
export function GET() {
  return NextResponse.json({ version: process.env.NEXT_PUBLIC_BUILD_ID ?? "development" }, { headers: { "Cache-Control": "no-store" } });
}

export const dynamic = "force-dynamic";
