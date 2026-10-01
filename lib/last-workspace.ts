import "server-only";
import { cookies } from "next/headers";
import { LAST_WORKSPACE_COOKIE } from "@/lib/last-workspace-cookie";
import { tenancyService } from "@/modules/tenancy/tenancy.service";


/** The workspace to open for this person: the last one they used if they still have access, else their first; null if none. */
export async function pickWorkspaceSlug(userId: string): Promise<string | null> {
  const workspaces = await tenancyService.listWorkspacesFor(userId);
  const last = (await cookies()).get(LAST_WORKSPACE_COOKIE)?.value;
  return (workspaces.find((w) => w.slug === last) ?? workspaces[0])?.slug ?? null;
}
