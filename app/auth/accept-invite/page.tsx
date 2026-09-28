import type { Metadata } from "next";
import Link from "next/link";
import { invitesService } from "@/modules/invites/invites.service";
import { AuthShell } from "../_components/AuthShell";
import { AcceptInviteForm } from "./_components/AcceptInviteForm";
import { ExpiredInvite } from "./_components/ExpiredInvite";

// Same as sign-in: not something to prompt "install the app" on, and never indexed (the URL carries a secret).
export const metadata: Metadata = { manifest: null, robots: { index: false, follow: false } };

// The link's state depends on the clock and the database, on every request.
export const dynamic = "force-dynamic";

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 text-sm text-cream/80">
      {children}
      <Link href="/auth/sign-in" className="block text-center text-accent hover:underline">
        Go to sign in
      </Link>
    </div>
  );
}

/**
 * Where an emailed invitation lands: /auth/accept-invite?token=… — pick a name and password to create the
 * account. Every state of the link has its own screen, including the expired one (which can send a new link).
 */
export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const link = token ? await invitesService.linkState(token) : ({ state: "invalid" } as const);

  if (link.state === "valid" && token) {
    return (
      <AuthShell title="Create your account" description="You've been invited to the TAGR CRM. Choose a password to finish.">
        <AcceptInviteForm token={token} email={link.email} />
      </AuthShell>
    );
  }

  if (link.state === "expired" && token) {
    return (
      <AuthShell title="This link has expired">
        <ExpiredInvite token={token} maskedEmail={link.maskedEmail} />
      </AuthShell>
    );
  }

  if (link.state === "used") {
    return (
      <AuthShell title="Invite already used">
        <Message>
          <p>This invitation was already used to create an account. You can sign in with your email and password.</p>
        </Message>
      </AuthShell>
    );
  }

  if (link.state === "revoked") {
    return (
      <AuthShell title="Invite no longer valid">
        <Message>
          <p>This invitation was cancelled. Ask the person who invited you to send a new one.</p>
        </Message>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Invalid invite link">
      <Message>
        <p>This link isn&rsquo;t valid — it may be incomplete, or a newer email replaced it. Open the most recent invitation email and use the link in it.</p>
      </Message>
    </AuthShell>
  );
}
