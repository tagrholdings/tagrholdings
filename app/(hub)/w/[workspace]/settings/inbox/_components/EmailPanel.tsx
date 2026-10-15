"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { SidePanel } from "@/components/shared/side-panel";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultDescription, VaultBody } from "@/components/ui/vault";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateUS } from "@/utils/date";
import { splitLinks } from "@/utils/linkify";
import type { ReceivedEmail, ReceivedEmailDetail } from "@/modules/leads/received-emails";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import { useIsMobile } from "@/hooks/ui/use-device";

const EXPLANATION: Record<Exclude<ReceivedEmail["outcome"], "read">, string> = {
  nothing: "The email was read, but no business for sale was recognised in it (a welcome message, a promotion, a confirmation…). It was kept as one lead so nothing disappears silently.",
  failed: "The automatic reading of this email failed, so no listing was extracted. Read it above and add the businesses by hand if there are any.",
};

const receivedAt = (email: ReceivedEmail) =>
  formatDateUS(email.receivedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The opened email, beside the list: Vault (mobile) / SidePanel (tablet+desktop) — see side-panel.tsx.
 * `email` (from the list) opens it at once; `detail` (with the text) arrives with the server render a moment later.
 */
export function EmailPanel({
  email,
  detail,
  onOpenChange,
}: {
  email: ReceivedEmail | null;
  detail: ReceivedEmailDetail | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const open = email !== null;
  const description = email ? `From ${email.from} · ${receivedAt(email)}` : undefined;

  if (isMobile) {
    return (
      <Vault open={open} onOpenChange={onOpenChange}>
        <VaultContent aria-label={email?.subject ?? "Email"}>
          {email && (
            <>
              <VaultHeader>
                <VaultTitle>{email.subject}</VaultTitle>
                <VaultDescription>{description}</VaultDescription>
              </VaultHeader>
              <VaultBody>
                <div className="pb-4">
                  <EmailBody email={email} detail={detail} />
                </div>
              </VaultBody>
            </>
          )}
        </VaultContent>
      </Vault>
    );
  }

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={email?.subject ?? ""} description={description} width={560}>
      {email && <EmailBody email={email} detail={detail} />}
    </SidePanel>
  );
}

/** The message as it arrived, then the businesses the AI read out of it. */
function EmailBody({ email, detail }: { email: ReceivedEmail; detail: ReceivedEmailDetail | null }) {
  const path = useWorkspacePath();

  return (
    <div className="flex flex-col gap-6">
      {!detail ? (
        <div className="space-y-2" aria-label="Loading the email">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : detail.body ? (
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
          {splitLinks(detail.body).map((part, i) =>
            part.kind === "link" ? (
              <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="break-all text-accent-text hover:text-accent-hover">
                {part.href}
              </a>
            ) : (
              part.value
            )
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          The text of this email wasn&rsquo;t kept: its first listing was already known from an earlier email, so it wasn&rsquo;t saved again.
        </p>
      )}

      <section className="flex flex-col gap-3 border-t border-divider pt-4">
        <h3 className="text-sm font-medium text-foreground">Found in this email</h3>
        {email.outcome !== "read" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{EXPLANATION[email.outcome]}</p>
            {email.fallbackLeadId && (
              <Link href={path(`/leads-inbox?lead=${email.fallbackLeadId}`)} className="inline-block text-sm font-medium text-accent-text hover:text-accent-hover">
                Open in Leads Inbox
              </Link>
            )}
          </div>
        )}
        {email.listings.map((listing) => (
          <div key={listing.leadId} className="rounded-lg border border-divider bg-background p-3">
            <p className="font-medium text-foreground">{listing.businessName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[listing.location, listing.askingPrice && `Asking ${listing.askingPrice}`, listing.revenue && `Revenue ${listing.revenue}`].filter(Boolean).join(" · ") ||
                "No location or price stated"}
            </p>
            {listing.summary && <p className="mt-2 text-sm text-foreground">{listing.summary}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <Link href={path(`/leads-inbox?lead=${listing.leadId}`)} className="font-medium text-accent-text hover:text-accent-hover">
                Open in Leads Inbox
              </Link>
              {listing.link && (
                <a href={listing.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:text-accent-hover">
                  Original listing
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
