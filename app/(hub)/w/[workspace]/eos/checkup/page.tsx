import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { EOS_CHECKUP_STATEMENTS } from "@/lib/eos-checkup";
import { tractionService } from "@/modules/traction/traction.service";
import { initialsFor } from "@/lib/utils";
import { CheckupView } from "./_components/CheckupView";

export const dynamic = "force-dynamic";

/**
 * EOS Organizational Checkup, saved: the same 20 statements as the portal's tool, scored by the leadership team at
 * kickoff and again later (the playbook asks for month 12) — the delta is the point.
 */
export default async function CheckupPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user, role } = await getWorkspace(slug);
  const checkups = await tractionService.getCheckups(user.tenantId);

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="EOS · Checkup" title="Organizational Checkup">
      <CheckupView statements={EOS_CHECKUP_STATEMENTS} checkups={checkups} isAdmin={role === "admin"} />
    </HubPage>
  );
}
