import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { teamService } from "@/modules/team/team.service";
import { initialsFor } from "@/lib/utils";
import { L10View } from "./_components/L10View";

export const dynamic = "force-dynamic";

/** The weekly Level 10 meeting, run from the CRM: the agenda on the left, live data for each step on the right. */
export default async function L10Page({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user, role } = await getWorkspace(slug);
  const [data, members, people] = await Promise.all([tractionService.getMeetingData(user.tenantId), tractionService.listOwners(user.tenantId), teamService.listPeople(user.tenantId)]);
  const active = people.filter((p) => !p.archivedAt);

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Traction · Weekly" title="L10 Meeting">
      <L10View
        {...data}
        members={members}
        raters={active.map((p) => ({ id: p.id, name: p.name, hasLogin: !!p.userId }))}
        mePersonId={active.find((p) => p.userId === user.id)?.id ?? null}
        isAdmin={role === "admin"}
      />
    </HubPage>
  );
}
