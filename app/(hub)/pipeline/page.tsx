import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { activitiesService } from "@/modules/activities/activities.service";
import { contactsService } from "@/modules/contacts/contacts.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { initialsFor } from "@/lib/utils";
import type { PipelineItemRow } from "@/components/pipeline/types";
import { ProjectsView } from "./_components/ProjectsView";

export const dynamic = "force-dynamic";

/**
 * Projects — every user-created board (one tab each). The system "Leads"
 * board lives on /leads and activities on /activities; neither is a
 * tab here anymore.
 */
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ board?: string; item?: string }> }) {
  const [{ board: boardParam, item }, user] = await Promise.all([searchParams, getCurrentUser()]);

  const [boards, activities, contacts, organizations, members, pipelineItems] = await Promise.all([
    pipelineService.listProjectBoards(user.tenantId),
    activitiesService.listForTenant(user.tenantId),
    contactsService.listForTenant(user.tenantId),
    organizationsService.listForTenant(user.tenantId),
    tenancyService.listMembers(user.tenantId),
    pipelineService.listAllForTenant(user.tenantId),
  ]);

  const itemsByBoard: Record<string, PipelineItemRow[]> = {};
  await Promise.all(
    boards.map(async (board) => {
      itemsByBoard[board.id] = await pipelineService.listForBoard(user.tenantId, board.id);
    })
  );

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Project boards"
      title="Projects"
    >
      <ProjectsView
        boards={boards}
        itemsByBoard={itemsByBoard}
        activities={activities}
        lookups={{ contacts, organizations, members, pipelineItems }}
        initialBoardId={boardParam ?? null}
        initialItemId={item ?? null}
      />
    </HubPage>
  );
}
