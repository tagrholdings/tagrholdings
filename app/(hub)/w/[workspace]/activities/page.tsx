import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { activitiesService } from "@/modules/activities/activities.service";
import { contactsService } from "@/modules/contacts/contacts.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { teamService } from "@/modules/team/team.service";
import { tractionService } from "@/modules/traction/traction.service";
import { initialsFor } from "@/lib/utils";
import { ActivitiesView } from "./_components/ActivitiesView";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ activity?: string; filter?: string }> }) {
  const [{ activity, filter }, { workspace: slug }] = await Promise.all([searchParams, params]);
  const { user } = await getWorkspace(slug);
  const [activities, contacts, organizations, pipelineItems, members, rocks] = await Promise.all([
    activitiesService.listForTenant(user.tenantId),
    contactsService.listForTenant(user.tenantId),
    organizationsService.listForTenant(user.tenantId),
    pipelineService.listAllForTenant(user.tenantId),
    teamService.listOptions(user.tenantId),
    tractionService.listOpenRocks(user.tenantId),
  ]);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="This week"
      title="Activities"
    >
      <ActivitiesView
        activities={activities}
        lookups={{ contacts, organizations, members, pipelineItems, rocks }}
        initialSelectedId={activity ?? null}
        initialFilter={filter}
      />
    </HubPage>
  );
}
