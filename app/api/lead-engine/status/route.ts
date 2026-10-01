import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

/**
 * GET /api/lead-engine/status?workspace=<slug> — the lead engine's recent GitHub Actions runs, polled by the Search
 * profiles tab to show a run live. A Route Handler (not a Server Action) because it is read repeatedly by SWR; it stays
 * thin — the session and the person's access to that workspace are checked here and the work is the service's.
 * (It isn't under `/w/…`, so the workspace travels as a query parameter instead of the proxy's header.)
 */
export async function GET(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slug = new URL(request.url).searchParams.get("workspace");
  const access = slug ? await tenancyService.resolveAccess(session.user.id, slug) : null;
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    return NextResponse.json(await leadEngineService.getLiveRuns(access.tenantId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/lead-engine/status failed:", error);
    return NextResponse.json({ error: "Could not load the engine status." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
