import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { contactsService } from "@/modules/contacts/contacts.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { activitiesService } from "@/modules/activities/activities.service";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { initialsFor } from "@/lib/utils";
import { ContactsView } from "./_components/ContactsView";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ contact?: string; org?: string }> }) {
  const [{ contact, org }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const [contacts, organizations, activities, pipelineItems, boards] = await Promise.all([
    contactsService.listForTenant(user.tenantId),
    organizationsService.listForTenant(user.tenantId),
    activitiesService.listForTenant(user.tenantId),
    pipelineService.listAllForTenant(user.tenantId),
    pipelineService.listBoards(user.tenantId),
  ]);

  return (
    <HubPage
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
        initialTab={org ? "organizations" : "people"}
        initialSelectedId={contact ?? null}
        initialSelectedOrgId={org ?? null}
      />
    </HubPage>
  );
}
