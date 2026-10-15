"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatDateUS } from "@/utils/date";
import { splitLinks } from "@/utils/linkify";
import type { ReceivedEmailDetail } from "@/modules/leads/received-emails";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";

const EXPLANATION: Record<Exclude<ReceivedEmailDetail["outcome"], "read">, string> = {
  nothing: "The email was read, but no business for sale was recognised in it (a welcome message, a promotion, a confirmation…). It was kept as one lead so nothing disappears silently.",
  failed: "The automatic reading of this email failed, so no listing was extracted. Read it above and add the businesses by hand if there are any.",
};

/** "Broker <a@b.test>" → { name: "Broker", address: "a@b.test" }. */
function sender(from: string) {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return match ? { name: match[1] || match[2], address: match[2] } : { name: from, address: null };
}

/** The email the way a mail client shows it: sender and date on top, the message below, then what the AI read out of it. */
export function EmailReader({ email }: { email: ReceivedEmailDetail }) {
  const path = useWorkspacePath();
  const from = sender(email.from);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <article data-tour="email-message" className="rounded-lg border border-divider bg-surface">
        <header className="flex items-start gap-3 border-b border-divider p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground uppercase">
            {from.name.trim().charAt(0) || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <span className="font-medium text-foreground">{from.name}</span>
              {from.address && from.address !== from.name && <span className="text-muted-foreground"> &lt;{from.address}&gt;</span>}
            </p>
            <p className="text-xs text-muted-foreground">to the leads inbox</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDateUS(email.receivedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        </header>
        <div className="p-4">
          {email.body ? (
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
              {splitLinks(email.body).map((part, i) =>
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
        </div>
      </article>

      <section data-tour="email-listings" className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Found in this email</h2>
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
          <div key={listing.leadId} className="rounded-lg border border-divider bg-surface p-3">
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
