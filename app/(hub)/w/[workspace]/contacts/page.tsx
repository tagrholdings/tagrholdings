import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { contactsService } from "@/modules/contacts/contacts.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { activitiesService } from "@/modules/activities/activities.service";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { teamService } from "@/modules/team/team.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { tractionService } from "@/modules/traction/traction.service";
import { initialsFor } from "@/lib/utils";
import { ContactsView } from "./_components/ContactsView";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ contact?: string; org?: string; tab?: string }> }) {
  const [{ contact, org, tab }, { workspace: slug }] = await Promise.all([searchParams, params]);
  const { user, role } = await getWorkspace(slug);
  const isAdmin = role === "admin";
  const [contacts, organizations, activities, pipelineItems, boards, people, seats, accounts] = await Promise.all([
    contactsService.listForTenant(user.tenantId),
    organizationsService.listForTenant(user.tenantId),
    activitiesService.listForTenant(user.tenantId),
    pipelineService.listAllForTenant(user.tenantId),
    pipelineService.listBoards(user.tenantId),
    teamService.listPeople(user.tenantId),
    tractionService.getSeats(user.tenantId),
    // Only an admin links a person to a login, so only an admin gets the list of logins.
    isAdmin ? tenancyService.listMembers(user.tenantId) : Promise.resolve([]),
  ]);

  return (
    <HubPage
      fitViewport
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Relationships"
      title="Contacts"
    >
      <ContactsView
        contacts={contacts}
        organizations={organizations}
        activities={activities}
        pipelineItems={pipelineItems}
        boards={boards.map((b) => ({ id: b.id, columns: b.columns }))}
        initialTab={tab === "team" ? "team" : org ? "organizations" : "people"}
        initialSelectedId={contact ?? null}
        initialSelectedOrgId={org ?? null}
        team={{ people, seats: seats.map((s) => ({ name: s.name, personId: s.personId })), accounts: accounts.map((a) => ({ id: a.id, name: a.name, email: a.email })), isAdmin }}
      />
    </HubPage>
  );
}
