import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/auth-server";
import { workspacePath } from "@/lib/workspace-path";
import { HubPage } from "@/components/layout/HubPage";
import { leadsService } from "@/modules/leads/leads.service";
import { initialsFor } from "@/lib/utils";
import { EmailReader } from "./_components/EmailReader";

export const dynamic = "force-dynamic";

/** One email the leads inbox received, read in full — like opening it in a mail client. */
export default async function ReceivedEmailPage({ params }: { params: Promise<{ workspace: string; emailId: string }> }) {
  const { workspace: slug, emailId } = await params;
  const { user } = await getWorkspace(slug);

  const email = await leadsService.getReceivedEmail(user.tenantId, decodeURIComponent(emailId));
  if (!email) notFound();

  return (
    <HubPage
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      backHref={workspacePath(slug, "/settings/inbox")}
      kicker="Inbox"
      title={email.subject}
    >
      <EmailReader email={email} />
    </HubPage>
  );
}
