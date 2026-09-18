import { notFound } from "next/navigation";
import { Mail, Phone, Building2, LayoutGrid, ListChecks } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-server";
import { AppShell } from "@/components/layout/AppShell";
import { contactsService } from "@/modules/contacts/contacts.service";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { activitiesService } from "@/modules/activities/activities.service";
import { initialsFor } from "@/lib/utils";
import { Empty, EmptyTitle } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  const contact = await contactsService.getById(user.tenantId, id).catch(() => null);
  if (!contact) notFound();

  const [pipelineItems, activities] = await Promise.all([
    pipelineService.listForContact(user.tenantId, id),
    activitiesService.listForContact(user.tenantId, id),
  ]);

  return (
    <AppShell
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      backHref="/contacts"
      kicker="Contact"
      title={contact.name}
    >
      <div className="rounded-lg border border-divider bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold text-foreground">
            {initialsFor(contact.name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-xl font-semibold text-foreground">{contact.name}</h2>
            {contact.organizationName && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="size-3.5" />
                {contact.organizationName}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-md border border-divider bg-background px-3 py-2.5 text-sm text-foreground">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            {contact.email ?? <span className="text-muted-foreground">No email on file</span>}
          </div>
          <div className="flex items-center gap-2 rounded-md border border-divider bg-background px-3 py-2.5 text-sm text-foreground">
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            {contact.phone ?? <span className="text-muted-foreground">No phone on file</span>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-divider bg-surface p-6">
        <p className="label-kicker mb-3">Pipeline items</p>
        {pipelineItems.length === 0 ? (
          <Empty className="border border-dashed border-divider py-8">
            <LayoutGrid className="mx-auto mb-2 size-6 text-muted-foreground" />
            <EmptyTitle className="text-sm">Not part of any deal yet</EmptyTitle>
          </Empty>
        ) : (
          <ul className="divide-y divide-divider">
            {pipelineItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="label-kicker">{item.stage}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-divider bg-surface p-6">
        <p className="label-kicker mb-3">Activity history</p>
        {activities.length === 0 ? (
          <Empty className="border border-dashed border-divider py-8">
            <ListChecks className="mx-auto mb-2 size-6 text-muted-foreground" />
            <EmptyTitle className="text-sm">No activity logged yet</EmptyTitle>
          </Empty>
        ) : (
          <ul className="divide-y divide-divider">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <span className="font-medium text-foreground">{activity.subject}</span>
                  <span className="ml-2 text-muted-foreground">{activity.type}</span>
                </div>
                <span className={activity.done ? "text-success" : "text-muted-foreground"}>
                  {activity.done ? "Done" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
