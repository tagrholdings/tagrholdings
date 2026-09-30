"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultDescription, VaultBody } from "@/components/ui/vault";
import { formatDateUS } from "@/utils/date";
import type { ReceivedEmail } from "@/modules/leads/received-emails";

const EXPLANATION: Record<Exclude<ReceivedEmail["outcome"], "read">, string> = {
  nothing: "The email was read, but no business for sale was recognised in it (a welcome message, a promotion, a confirmation…). It was kept as one lead so nothing disappears silently.",
  failed: "The automatic reading of this email failed, so no listing was extracted. Open it in the Leads Inbox to read what it says, and add the businesses by hand if there are any.",
};

/** One received email: who sent it and the businesses for sale the AI found in it. */
export function EmailVault({ email, onOpenChange }: { email: ReceivedEmail | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Vault open={email !== null} onOpenChange={onOpenChange}>
      <VaultContent aria-label={email?.subject ?? "Email"}>
        {email && (
          <>
            <VaultHeader>
              <VaultTitle>{email.subject}</VaultTitle>
              <VaultDescription>
                From {email.from} · {formatDateUS(email.receivedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </VaultDescription>
            </VaultHeader>
            <VaultBody>
              <div className="space-y-3 pb-4">
                {email.outcome !== "read" && (
                  <>
                    <p className="text-sm text-muted-foreground">{EXPLANATION[email.outcome]}</p>
                    {email.fallbackLeadId && (
                      <Link href={`/leads-inbox?lead=${email.fallbackLeadId}`} className="inline-block text-sm font-medium text-accent-text hover:text-accent-hover">
                        Open in Leads Inbox
                      </Link>
                    )}
                  </>
                )}
                {email.listings.map((listing) => (
                  <div key={listing.leadId} className="rounded-lg border border-divider bg-surface p-3">
                    <p className="font-medium text-foreground">{listing.businessName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[listing.location, listing.askingPrice && `Asking ${listing.askingPrice}`, listing.revenue && `Revenue ${listing.revenue}`].filter(Boolean).join(" · ") ||
                        "No location or price stated"}
                    </p>
                    {listing.summary && <p className="mt-2 text-sm text-foreground">{listing.summary}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <Link href={`/leads-inbox?lead=${listing.leadId}`} className="font-medium text-accent-text hover:text-accent-hover">
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
              </div>
            </VaultBody>
          </>
        )}
      </VaultContent>
    </Vault>
  );
}
