import { getCurrentUser } from "@/lib/auth-server";
import { HubChrome } from "@/components/layout/HubChrome";
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

  return (
    <HubChrome user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}>
      {children}
    </HubChrome>
  );
}
