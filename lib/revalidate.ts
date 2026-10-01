import "server-only";
import { revalidatePath } from "next/cache";
import { workspacePath } from "@/lib/workspace-path";

/**
 * Revalidates pages of ONE workspace: `revalidateWorkspace(ctx.workspace.slug, "/activities", "/contacts")`. Paths are
 * workspace-relative; the `/w/<slug>` prefix is added here, so a mutation in workspace A never touches B's cache.
 */
export function revalidateWorkspace(slug: string, ...paths: string[]) {
  for (const path of paths) revalidatePath(workspacePath(slug, path));
}
