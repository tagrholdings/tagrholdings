import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { initialsFor } from "@/lib/utils";
import { VtoView } from "./_components/VtoView";

export const dynamic = "force-dynamic";

/** The Vision/Traction Organizer — the company's plan on one page. Its Rocks and Issues sections are live, not copies. */
export default async function VtoPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const [vto, rocksData, issues, members] = await Promise.all([
    tractionService.getVto(user.tenantId),
    tractionService.getRocks(user.tenantId),
    tractionService.getIssues(user.tenantId),
    tenancyService.listMembers(user.tenantId),
  ]);

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Traction" title="Vision / Traction Organizer">
      <VtoView
        content={vto.content}
        updatedAt={vto.updatedAt}
        quarter={rocksData.focusQuarter}
        rocks={rocksData.rocks.filter((r) => r.quarter === rocksData.focusQuarter)}
        longTermIssues={issues.filter((i) => i.horizon === "long_term" && i.status === "open")}
        members={members}
      />
    </HubPage>
  );
}
