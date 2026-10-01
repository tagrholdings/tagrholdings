import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { initialsFor } from "@/lib/utils";
import { SettingsTabs } from "../_components/SettingsTabs";
import { MembersView } from "./_components/MembersView";

export const dynamic = "force-dynamic";

/** Who is in this workspace and with what role — admins only (a plain member gets a 404, like any page they can't use). */
export default async function MembersSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (workspace.role !== "admin") notFound();
  const { user } = workspace;
  const members = await tenancyService.listMembers(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Settings"
      title="Members"
    >
      <SettingsTabs active="members" />
      <MembersView members={members} currentUserId={user.id} />
    </HubPage>
  );
}
