import { getCurrentUser } from "@/lib/auth-server";
import { HubChrome } from "@/components/layout/HubChrome";
import { leadsService } from "@/modules/leads/leads.service";
import { initialsFor } from "@/lib/utils";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM - Tagr",
  description: "Your hub for managing pipelines, contacts, and more."
};

// getCurrentUser() reads request cookies — can't be statically rendered.
export const dynamic = "force-dynamic";

/**
 * Renders Sidebar/BottomNav once for the whole (hub) route group, so they
 * persist across navigations instead of remounting per page — see
 * components/layout/HubChrome.tsx. Each page still renders its own
 * AppHeader/main via HubPage.tsx, since title/kicker differ per route.
 */

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Unreviewed engine finds — the Leads Inbox badge. A failed count must never
  // take the whole app shell down, so it degrades to "no badge".
  const leadsInboxUnread = await leadsService.countNew(user.tenantId).catch(() => 0);

  return (
    <HubChrome
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      badges={{ leadsInboxUnread }}
    >
      {children}
    </HubChrome>
  );
}
