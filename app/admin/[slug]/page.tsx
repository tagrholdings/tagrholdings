import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-server";
import { inboundAddressFor } from "@/lib/inbound-address";
import { workspacePath } from "@/lib/workspace-path";
import { formatDateUS } from "@/utils/date";
import { invitesService } from "@/modules/invites/invites.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { DangerZone } from "./_components/DangerZone";
import { InviteUserForm } from "./_components/InviteUserForm";
import { RenameWorkspaceForm } from "./_components/RenameWorkspaceForm";

export const metadata: Metadata = { title: "Manage workspace - TAGR CRM", manifest: null, robots: { index: false, follow: false } };

// Reads the session — can't be statically rendered.
export const dynamic = "force-dynamic";

const STATUS_LABEL = { pending: "Pending", expired: "Expired", accepted: "Accepted", revoked: "Revoked" } as const;

/** Super admin: manage ONE workspace — its name, its people (invite), and archiving / deleting it. */
export default async function ManageWorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, user] = await Promise.all([params, getCurrentUser()]);
  if (!(await tenancyService.isSuperAdmin(user.id))) notFound();
  const workspace = await tenancyService.getBySlug(slug);
  if (!workspace) notFound();

  const [members, invites] = await Promise.all([tenancyService.listMembers(workspace.id), invitesService.listForTenant(workspace.id)]);
  const archived = !!workspace.archivedAt;
  const address = inboundAddressFor(workspace.inboundLocalPart);
  const openInvites = invites.filter((invite) => invite.status === "pending" || invite.status === "expired");

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-3">
          <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:text-accent-hover">
            <ChevronLeft className="size-4" aria-hidden />
            All workspaces
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="label-kicker text-muted-foreground">Workspace</p>
              <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold text-foreground">
                <span className="truncate">{workspace.name}</span>
                {archived && <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-muted-foreground">Archived</span>}
              </h1>
              <p className="text-sm text-muted-foreground">
                /w/{workspace.slug}
                {address ? ` · ${address}` : ""}
              </p>
            </div>
            <Link
              href={workspacePath(workspace.slug, "/activities")}
              className="rounded-md border border-divider bg-surface px-3 py-1.5 text-sm font-medium text-accent-text transition-colors hover:border-accent hover:text-accent-hover"
            >
              Open workspace
            </Link>
          </div>
          {archived && (
            <p className="rounded-md border border-divider bg-surface p-3 text-sm text-muted-foreground">
              This workspace is archived: its members can&rsquo;t open it, and no job runs for it. Nothing was deleted &mdash; restore it below to reopen it.
            </p>
          )}
        </header>

        <section className="rounded-lg border border-divider bg-surface p-5">
          <h2 className="font-serif text-lg font-semibold text-foreground">Name</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">The name people see. The address (/w/{workspace.slug}) stays the same.</p>
          <RenameWorkspaceForm id={workspace.id} name={workspace.name} />
        </section>

        <section className="rounded-lg border border-divider bg-surface p-5">
          <h2 className="font-serif text-lg font-semibold text-foreground">People</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Invite someone by email: they get a link to choose their own password. Admins can invite and manage members from the workspace&rsquo;s own Settings.
          </p>
          <InviteUserForm workspaceId={workspace.id} disabled={archived} />

          <h3 className="mt-6 mb-2 text-sm font-semibold text-foreground">Members ({members.length})</h3>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one yet.</p>
          ) : (
            <ul className="divide-y divide-divider rounded-md border border-divider">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{member.name || member.email}</span>
                    {member.name && <span className="block truncate text-xs text-muted-foreground">{member.email}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground capitalize">{member.role}</span>
                </li>
              ))}
            </ul>
          )}

          {openInvites.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 text-sm font-semibold text-foreground">Open invites ({openInvites.length})</h3>
              <ul className="divide-y divide-divider rounded-md border border-divider">
                {openInvites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-foreground">{invite.email}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <span className="capitalize">{invite.role}</span> · {STATUS_LABEL[invite.status]} · sent {formatDateUS(invite.lastSentAt, { month: "short", day: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">To resend or revoke an invite, open the workspace &rarr; Settings &rarr; Invites.</p>
            </>
          )}
        </section>

        <DangerZone id={workspace.id} name={workspace.name} archived={archived} />
      </div>
    </div>
  );
}
