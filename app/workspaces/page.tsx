import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-server";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { workspacePath } from "@/lib/workspace-path";
import { AuthShell } from "../auth/_components/AuthShell";

export const metadata: Metadata = { title: "Workspaces - TAGR CRM" };

// Reads the session — can't be statically rendered.
export const dynamic = "force-dynamic";

/**
 * Pick a workspace — also where someone with no workspace yet lands (nothing to open until an admin invites them).
 * A super admin gets a way into the platform's workspace list.
 */
export default async function WorkspacesPage() {
  const user = await getCurrentUser();
  const [workspaces, isSuperAdmin] = await Promise.all([tenancyService.listWorkspacesFor(user.id), tenancyService.isSuperAdmin(user.id)]);

  return (
    <AuthShell
      title={workspaces.length > 0 ? "Choose a workspace" : "No workspace yet"}
      description={workspaces.length > 0 ? "Pick where to work. You can switch any time from your avatar." : undefined}
      kicker="Workspaces"
    >
      {workspaces.length === 0 ? (
        <p className="text-sm text-cream/70">You aren&rsquo;t part of a workspace yet. Ask an admin to invite you, then open the link in the email.</p>
      ) : (
        <ul className="space-y-2">
          {workspaces.map((workspace) => (
            <li key={workspace.slug}>
              <Link
                href={workspacePath(workspace.slug, "/activities")}
                className="flex items-center justify-between rounded-md border border-cream/15 px-4 py-3 text-sm text-cream transition-colors hover:border-accent hover:text-accent"
              >
                <span className="truncate">{workspace.name}</span>
                <span className="ml-3 shrink-0 text-xs text-cream/50">{workspace.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isSuperAdmin && (
        <Link href="/admin" className="mt-6 block text-center text-sm text-accent hover:underline">
          Manage workspaces
        </Link>
      )}
    </AuthShell>
  );
}
