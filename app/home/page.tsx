import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { pickWorkspaceSlug } from "@/lib/last-workspace";
import { isWorkspaceSectionPath, workspacePath } from "@/lib/workspace-path";

// Reads the session and a cookie — can't be statically rendered.
export const dynamic = "force-dynamic";

/**
 * Where "/" (proxy.ts rewrites it here), the old pre-workspace URLs (`?to=/contacts/12`) and a fresh sign-in land: it
 * picks the workspace to open — the last one used, else the first the person belongs to — and redirects into it. A
 * person with no workspace goes to /workspaces. `to` is user-supplied, so it must be one of the hub's own sections.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const [user, { to }] = await Promise.all([getCurrentUser(), searchParams]);
  const slug = await pickWorkspaceSlug(user.id);
  if (!slug) redirect("/workspaces");
  redirect(workspacePath(slug, to && isWorkspaceSectionPath(to) ? to : "/activities"));
}
