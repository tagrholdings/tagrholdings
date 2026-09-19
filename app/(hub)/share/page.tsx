import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { prefillFromShare, type ShareParams } from "./prefill";

export const dynamic = "force-dynamic";

/**
 * Web Share Target landing (app/manifest.ts → share_target, method GET): what the phone's "Share…" sheet sends
 * when someone picks the installed CRM. It ingests nothing itself — it only turns the shared title/text/url into
 * the value to pre-fill in the Leads Inbox quick-add box (the ONE ingestion flow) and sends the person there to
 * confirm with "Add".
 *
 * A signed-out visitor is sent to sign-in first (getCurrentUser redirects), which drops the shared data — the
 * installed app normally has a live session, so that's the rare case.
 */
export default async function SharePage({ searchParams }: { searchParams: Promise<ShareParams> }) {
  const [params] = await Promise.all([searchParams, getCurrentUser()]);
  const add = prefillFromShare(params).slice(0, 5000);
  redirect(add ? `/leads-inbox?add=${encodeURIComponent(add)}` : "/leads-inbox");
}
