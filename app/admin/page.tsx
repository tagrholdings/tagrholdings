import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-server";
import { inboundAddressFor } from "@/lib/inbound-address";
import { workspacePath } from "@/lib/workspace-path";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { CreateWorkspaceForm } from "./_components/CreateWorkspaceForm";

export const metadata: Metadata = { title: "Workspaces - TAGR CRM", manifest: null, robots: { index: false, follow: false } };

// Reads the session — can't be statically rendered.
export const dynamic = "force-dynamic";

/**
 * Platform admin: every workspace (archived ones last), a form to create one, and a page per workspace to manage it.
 * Only a super admin (a platform role, granted by scripts/grant-super-admin.ts) sees this — anyone else gets a plain 404.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!(await tenancyService.isSuperAdmin(user.id))) notFound();
  const workspaces = await tenancyService.listForAdmin();

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="label-kicker text-muted-foreground">Platform</p>
            <h1 className="font-serif text-2xl font-semibold text-foreground">Workspaces</h1>
          </div>
          <Link href="/home" className="text-sm font-medium text-accent-text hover:text-accent-hover">
            Back to the CRM
          </Link>
        </header>

        <section className="rounded-lg border border-divider bg-surface p-5">
          <h2 className="font-serif text-lg font-semibold text-foreground">Create a workspace</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Each workspace is a separate company: its own people, data and leads inbox. Add an email to invite its first admin.
          </p>
          <CreateWorkspaceForm />
        </section>

        <section className="flex flex-col gap-2">
          {workspaces.map((workspace) => {
            const archived = !!workspace.archivedAt;
            const address = inboundAddressFor(workspace.inboundLocalPart);
            return (
              <div key={workspace.id} className="flex items-stretch gap-2">
                <Link
                  href={`/admin/${workspace.slug}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg border border-divider bg-surface px-4 py-3 transition-colors hover:border-accent"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-sm font-medium ${archived ? "text-muted-foreground" : "text-foreground"}`}>{workspace.name}</span>
                      {archived && <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">Archived</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      /w/{workspace.slug} · {workspace.memberCount} member{workspace.memberCount === 1 ? "" : "s"}
                      {address ? ` · ${address}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                    Manage
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
                <Link
                  href={workspacePath(workspace.slug, "/activities")}
                  className="flex shrink-0 items-center rounded-lg border border-divider bg-surface px-3 text-xs font-medium text-accent-text transition-colors hover:border-accent hover:text-accent-hover"
                >
                  Open
                </Link>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
