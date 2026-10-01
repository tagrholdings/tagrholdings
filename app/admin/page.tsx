import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { inboundAddressFor } from "@/lib/inbound-address";
import { workspacePath } from "@/lib/workspace-path";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { CreateWorkspaceForm } from "./_components/CreateWorkspaceForm";

export const metadata: Metadata = { title: "Workspaces - TAGR CRM", manifest: null, robots: { index: false, follow: false } };

// Reads the session — can't be statically rendered.
export const dynamic = "force-dynamic";

/**
 * Platform admin: every workspace, and a form to create one (with its first admin invited by email). Only a super admin
 * (a platform role, granted by scripts/grant-super-admin.ts) sees this — anyone else gets a plain 404.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!(await tenancyService.isSuperAdmin(user.id))) notFound();
  const workspaces = await tenancyService.listTenants();
  const details = await Promise.all(workspaces.map((w) => tenancyService.getTenant(w.id)));

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
          {workspaces.map((workspace, index) => {
            const address = details[index] ? inboundAddressFor(details[index].inboundLocalPart) : null;
            return (
              <Link
                key={workspace.id}
                href={workspacePath(workspace.slug, "/activities")}
                className="flex items-center justify-between gap-4 rounded-lg border border-divider bg-surface px-4 py-3 transition-colors hover:border-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{workspace.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    /w/{workspace.slug}
                    {address ? ` · ${address}` : ""}
                  </span>
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
