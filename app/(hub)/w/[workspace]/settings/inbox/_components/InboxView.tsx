"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox as InboxIcon } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import type { ReceivedEmail, ReceivedEmailDetail } from "@/modules/leads/received-emails";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import { EmailPanel } from "./EmailPanel";

const OUTCOME: Record<ReceivedEmail["outcome"], { label: (count: number) => string; className: string }> = {
  read: { label: (n) => `${n} listing${n === 1 ? "" : "s"}`, className: "border-accent bg-accent/15 text-foreground" },
  nothing: { label: () => "No listing found", className: "border-divider bg-transparent text-muted-foreground" },
  failed: { label: () => "Couldn’t be read", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

export function InboxView({
  emails,
  opened,
  inboxAddress,
}: {
  emails: ReceivedEmail[];
  /** The email named by `?email=`, with its text — loaded by the page. */
  opened: ReceivedEmailDetail | null;
  inboxAddress: string | null;
}) {
  const router = useRouter();
  const path = useWorkspacePath();
  const [, startTransition] = useTransition();
  // Set right away so the panel opens on click; its text arrives with the server render the URL change triggers.
  const [selectedId, setSelectedId] = useState<string | null>(opened?.emailId ?? null);
  const selected = emails.find((e) => e.emailId === selectedId) ?? null;

  const select = (emailId: string | null) => {
    setSelectedId(emailId);
    const href = emailId ? `${path("/settings/inbox")}?email=${encodeURIComponent(emailId)}` : path("/settings/inbox");
    startTransition(() => router.replace(href, { scroll: false }));
  };

  if (emails.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Empty data-tour="inbox-table">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>No emails received yet</EmptyTitle>
            <EmptyDescription>
              Send or forward a listing email to {inboxAddress ?? "the inbox address"} and it will appear here within a minute. If nothing shows up, check that the Resend
              webhook is registered.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    // See components/shared/side-panel.tsx — this row lets the opened email push the table aside instead of covering it.
    <div className="flex min-w-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Table data-tour="inbox-table">
          <TableHeader>
            <tr>
              <TableHead>Email</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {emails.map((email) => {
              const outcome = OUTCOME[email.outcome];
              return (
                <TableRow
                  key={email.emailId}
                  onClick={() => select(email.emailId)}
                  className={cn("cursor-pointer", email.emailId === selectedId && "md:bg-surface-alt")}
                >
                  <TableCell mobileLabel="Email" noWrapper>
                    <div className="min-w-0 text-right md:text-left">
                      <span className="block truncate font-medium text-foreground">{email.subject}</span>
                      <span className="block truncate text-xs text-muted-foreground">{email.from}</span>
                    </div>
                  </TableCell>
                  <TableCell mobileLabel="Result">
                    <span className={cn("inline-flex items-center rounded-pill border px-2 py-0.5 text-xs font-medium", outcome.className)}>
                      {outcome.label(email.listings.length)}
                    </span>
                  </TableCell>
                  <TableCell mobileLabel="Received" className="text-muted-foreground">
                    {formatDateUS(email.receivedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </TableCell>
                  <TableCell hideBorderMobile className="md:justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        select(email.emailId);
                      }}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <EmailPanel email={selected} detail={opened?.emailId === selectedId ? opened : null} onOpenChange={(open) => !open && select(null)} />
    </div>
  );
}
