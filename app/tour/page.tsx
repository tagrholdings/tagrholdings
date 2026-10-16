import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth-server";
import { workspacePath } from "@/lib/workspace-path";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { TourView } from "./_components/TourView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Platform tour — TAGR CRM", robots: { index: false } };

/**
 * /tour?from=<workspace> — the platform tour: a short, interactive walk through every page of the CRM, for someone
 * who has never used it. Outside the hub (no sidebar around it) but behind the same login — its examples carry real
 * portfolio numbers. "Back to the CRM" returns to the Documentation of the workspace it was opened from, only when the
 * person can open that workspace; otherwise to their home.
 */
export default async function TourPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const user = await getCurrentUser();
  const { from } = await searchParams;
  const access = from ? await tenancyService.resolveAccess(user.id, from) : null;
  return <TourView backHref={access && from ? workspacePath(from, "/docs") : "/home"} />;
}
