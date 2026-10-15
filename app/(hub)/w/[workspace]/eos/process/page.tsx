import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { tractionService } from "@/modules/traction/traction.service";
import { initialsFor } from "@/lib/utils";
import { ProcessView } from "./_components/ProcessView";

export const dynamic = "force-dynamic";

/** EOS Process: the company's core processes, documented as named steps and followed by all (the 20/80 rule). */
export default async function ProcessPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);
  const [processes, members] = await Promise.all([tractionService.getProcesses(user.tenantId), tractionService.listOwners(user.tenantId)]);

  return (
    <HubPage fitViewport user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="EOS · Process" title="Core processes">
      <ProcessView processes={processes} members={members} />
    </HubPage>
  );
}
