import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { activitiesService } from "@/modules/activities/activities.service";
import { contactsService } from "@/modules/contacts/contacts.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { initialsFor } from "@/lib/utils";
import { PipelineView } from "@/components/pipeline/PipelineView";

export const dynamic = "force-dynamic";

/** The system "Leads" board — kanban + list over the same pipeline_items as Projects. */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [{ item }, user] = await Promise.all([searchParams, getCurrentUser()]);

  const board = await pipelineService.ensureDefaultBoard(user.tenantId);
  const [items, activities, contacts, organizations, members, pipelineItems] = await Promise.all([
    pipelineService.listForBoard(user.tenantId, board.id),
    activitiesService.listForTenant(user.tenantId),
    contactsService.listForTenant(user.tenantId),
    organizationsService.listForTenant(user.tenantId),
    tenancyService.listMembers(user.tenantId),
    pipelineService.listAllForTenant(user.tenantId),
  ]);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Deal flow"
      title="Leads"
    >
      <PipelineView
        board={board}
        items={items}
        activities={activities}
        lookups={{ contacts, organizations, members, pipelineItems }}
        itemNoun="lead"
        initialSelectedId={item ?? null}
      />
    </HubPage>
  );
}
