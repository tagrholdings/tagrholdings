"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { requestNewInviteLinkAction } from "@/modules/invites/invites.actions";

/**
 * The link was opened after its expiry. The person can ask for a fresh one right here; it is emailed to the
 * address the invite was made for (shown masked), so they don't have to go back to whoever invited them.
 */
export function ExpiredInvite({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function requestNewLink() {
    setSending(true);
    try {
      const result = await requestNewInviteLinkAction({ token });
      if (!result?.data) {
        notify.error(result?.serverError ?? "Couldn't send a new link. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      notify.error("Couldn't send a new link. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <p className="text-cream/80" aria-live="polite">
            A new link is on its way to <span className="font-medium text-cream">{maskedEmail}</span>. It can take a minute to arrive — check your spam folder too.
          </p>
        </div>
        <p className="text-cream/55">The old link no longer works; use the newest email.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-start gap-3">
        <MailWarning className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <p className="text-cream/80">
          Invite links stay valid for a limited time, and this one has run out. We can email a fresh one to <span className="font-medium text-cream">{maskedEmail}</span>.
        </p>
      </div>
      <Button loading={sending} onClick={requestNewLink} className="w-full">
        Send me a new link
      </Button>
      <p className="text-center text-cream/55">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
