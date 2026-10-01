import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { pickWorkspaceSlug } from "@/lib/last-workspace";
import { workspacePath } from "@/lib/workspace-path";
import { prefillFromShare, type ShareParams } from "./prefill";

export const dynamic = "force-dynamic";

/**
 * Web Share Target landing (app/manifest.ts → share_target, method GET): what the phone's "Share…" sheet sends
 * when someone picks the installed CRM. It ingests nothing itself — it only turns the shared title/text/url into
 * the value to pre-fill in the Leads Inbox "Add lead" Vault (the ONE ingestion flow) and sends the person there to
 * confirm with "Add".
 *
 * It has no workspace in its URL, so it opens the last workspace used.
 *
 * A signed-out visitor is sent to sign-in first (getCurrentUser redirects), which drops the shared data — the
 * installed app normally has a live session, so that's the rare case.
 */
export default async function SharePage({ searchParams }: { searchParams: Promise<ShareParams> }) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const add = prefillFromShare(params).slice(0, 5000);
  // A share arrives with no workspace in its URL (the manifest's share_target is fixed), so it goes to the one last used.
  const slug = await pickWorkspaceSlug(user.id);
  if (!slug) redirect("/workspaces");
  redirect(workspacePath(slug, add ? `/leads-inbox?add=${encodeURIComponent(add)}` : "/leads-inbox"));
}
