import { getCurrentUser } from "@/lib/auth-server";
import { AppShell } from "@/components/layout/AppShell";
import { contactsService } from "@/modules/contacts/contacts.service";
import { initialsFor } from "@/lib/utils";
import { ContactsView } from "./_components/ContactsView";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  const contacts = await contactsService.listForTenant(user.tenantId);

  return (
    <AppShell
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Relationships"
      title="Contacts"
    >
      <ContactsView contacts={contacts} />
    </AppShell>
  );
}
