import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

/**
 * GET /api/lead-engine/status — the lead engine's recent GitHub Actions runs, polled by the Search profiles tab
 * to show a run live. A Route Handler (not a Server Action) because it is read repeatedly by SWR; it stays
 * thin — the session is checked here and the work is the service's. Signed-in members only.
 */
export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenantId = await tenancyService.getTenantIdForUser(session.user.id);
    return NextResponse.json(await leadEngineService.getLiveRuns(tenantId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/lead-engine/status failed:", error);
    return NextResponse.json({ error: "Could not load the engine status." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
