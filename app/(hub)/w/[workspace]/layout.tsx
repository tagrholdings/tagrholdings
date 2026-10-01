import { getWorkspace } from "@/lib/auth-server";
import { inboundAddressFor } from "@/lib/inbound-address";
import { HubChrome } from "@/components/layout/HubChrome";
import { leadsService } from "@/modules/leads/leads.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { initialsFor } from "@/lib/utils";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM - Tagr",
  description: "Your hub for managing pipelines, contacts, and more."
};

// getWorkspace() reads request cookies — can't be statically rendered.
export const dynamic = "force-dynamic";

/**
 * Renders Sidebar/BottomNav once per workspace for the whole `w/[workspace]` route group, so they persist across
 * navigations inside it instead of remounting per page — see components/layout/HubChrome.tsx. Each page still renders
 * its own AppHeader/main via HubPage.tsx, since title/kicker differ per route.
 *
 * `key={slug}`: switching workspace remounts the whole chrome AND every page's client state (filters, search, optimistic
 * rows, open panels), so nothing of the previous workspace can survive under the new one's name.
 */
export default async function HubLayout({ children, params }: { children: React.ReactNode; params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  const { user } = workspace;

  // Unreviewed engine finds — the Leads Inbox badge. A failed count must never
  // take the whole app shell down, so it degrades to "no badge".
  const [leadsInboxUnread, workspaces] = await Promise.all([
    leadsService.countNew(workspace.tenantId).catch(() => 0),
    tenancyService.listWorkspacesFor(user.id),
  ]);

  return (
    <HubChrome
      key={workspace.slug}
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      workspace={{
        slug: workspace.slug,
        name: workspace.name,
        role: workspace.role,
        isSuperAdmin: workspace.isSuperAdmin,
        inboundAddress: inboundAddressFor(workspace.inboundLocalPart),
        workspaces: workspaces.map(({ slug: s, name, role }) => ({ slug: s, name, role })),
      }}
      badges={{ leadsInboxUnread }}
    >
      {children}
    </HubChrome>
  );
}
