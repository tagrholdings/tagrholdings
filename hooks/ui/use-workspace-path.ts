"use client";

import { useParams } from "next/navigation";
import { workspacePath } from "@/lib/workspace-path";

/** The current workspace's slug, from the `/w/[workspace]` route segment. */
export function useWorkspaceSlug(): string {
  return useParams<{ workspace: string }>().workspace;
}

/**
 * `const path = useWorkspacePath(); <Link href={path("/contacts")} />` — builds an in-app link inside the CURRENT
 * workspace, so a component never hard-codes "/contacts" (which would 404 or, worse, leave the workspace).
 */
export function useWorkspacePath() {
  const slug = useWorkspaceSlug();
  return (path = "") => workspacePath(slug, path);
}
