import { redirect } from "next/navigation";
import { workspacePath } from "@/lib/workspace-path";

/** /settings has no content of its own — it opens its first tab. */
export default async function SettingsIndexPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  redirect(workspacePath(workspace, "/settings/notifications"));
}
