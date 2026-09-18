import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { contactsService } from "@/modules/contacts/contacts.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { activitiesService } from "@/modules/activities/activities.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { initialsFor } from "@/lib/utils";
import { ContactProfileView } from "./_components/ContactProfileView";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  const contact = await contactsService.getById(user.tenantId, id).catch(() => null);
  if (!contact) notFound();

  const [contacts, organizations, pipelineItems, activities, boards, members] = await Promise.all([
    contactsService.listForTenant(user.tenantId),
    organizationsService.listForTenant(user.tenantId),
    pipelineService.listAllForTenant(user.tenantId),
    activitiesService.listForTenant(user.tenantId),
    pipelineService.listBoards(user.tenantId),
    tenancyService.listMembers(user.tenantId),
  ]);

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      backHref="/contacts"
      kicker="Contact"
      title={contact.name}
    >
      <ContactProfileView
        contact={contact}
        contacts={contacts}
        organizations={organizations}
        pipelineItems={pipelineItems}
        activities={activities}
        boards={boards.map((b) => ({ id: b.id, columns: b.columns }))}
        members={members}
      />
    </HubPage>
  );
}
