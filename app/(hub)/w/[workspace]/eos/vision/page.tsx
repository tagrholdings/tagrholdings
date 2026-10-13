import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { initialsFor } from "@/lib/utils";
import { VtoView } from "./_components/VtoView";

export const dynamic = "force-dynamic";

/** EOS Vision: the Vision/Traction Organizer — where the company is going and how it gets there, on one page. */
export default async function VisionPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const [vto, rocksData, issues, members, checks] = await Promise.all([
    tractionService.getVto(user.tenantId),
    tractionService.getRocks(user.tenantId),
    tractionService.getIssues(user.tenantId),
    tractionService.listOwners(user.tenantId),
    tractionService.getRuleChecks(user.tenantId),
  ]);

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="EOS · Vision" title="Vision / Traction Organizer">
      <VtoView
        content={vto.content}
        updatedAt={vto.updatedAt}
        quarter={rocksData.focusQuarter}
        rocks={rocksData.rocks.filter((r) => r.quarter === rocksData.focusQuarter && r.status !== "rolled_over")}
        longTermIssues={issues.filter((i) => i.horizon === "long_term" && i.status === "open")}
        members={members}
        checks={checks.filter((c) => c.area === "vision")}
      />
    </HubPage>
  );
}
