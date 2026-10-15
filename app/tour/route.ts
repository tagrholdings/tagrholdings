import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth-server";
import { workspacePath } from "@/lib/workspace-path";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { PRESENTATION_HTML } from "./presentation-html";

export const dynamic = "force-dynamic";

/**
 * /tour?from=<workspace> — the platform tour: a short, interactive presentation of the whole CRM, as its own full
 * page (no CRM chrome around it). The document is content/presentation/index.html, served as-is so its deck layout,
 * keyboard navigation and phone reading mode work untouched. Behind the login like the rest of the CRM — it carries
 * real portfolio numbers. "Back to the CRM" returns to the Documentation of the workspace it was opened from, only
 * when the person can open that workspace; otherwise to their home.
 */
export async function GET(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const from = request.nextUrl.searchParams.get("from") ?? "";
  const access = from ? await tenancyService.resolveAccess(session.user.id, from) : null;
  const back = access ? workspacePath(from, "/docs") : "/home";

  return new NextResponse(PRESENTATION_HTML.replaceAll("__BACK_HREF__", back), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
