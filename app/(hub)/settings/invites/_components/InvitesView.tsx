"use client";

import { useState } from "react";
import { MailPlus, Send, Users, X } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { resendInviteAction, revokeInviteAction } from "@/modules/invites/invites.actions";
import type { InviteStatus, InviteSummary } from "@/modules/invites/invites.types";
import { InviteVault } from "./InviteVault";

const STATUS: Record<InviteStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-accent/15 text-foreground" },
  expired: { label: "Expired", className: "bg-destructive/10 text-destructive" },
  accepted: { label: "Accepted", className: "bg-green-600/10 text-green-800 dark:text-green-400" },
  revoked: { label: "Revoked", className: "bg-muted text-muted-foreground" },
};

export function InvitesView({ invites }: { invites: InviteSummary[] }) {
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<{ serverError?: string; data?: unknown } | undefined>, success: string, failure: string) {
    setBusyId(id);
    try {
      const result = await action();
      if (!result?.data) notify.error(result?.serverError ?? failure);
      else notify.success(success);
    } finally {
      setBusyId(null);
    }
  }

  const inviteButton = (
    <Button onClick={() => setInviting(true)}>
      <MailPlus />
      Invite someone
    </Button>
  );
  const vault = <InviteVault open={inviting} onOpenChange={setInviting} />;

  if (invites.length === 0) {
    return (
      <>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No invites yet</EmptyTitle>
            <EmptyDescription>
              Enter someone&rsquo;s email and they&rsquo;ll receive a link to create their own account and sign in to the CRM.
            </EmptyDescription>
          </EmptyHeader>
          {inviteButton}
        </Empty>
        {vault}
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">{inviteButton}</div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last sent</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => {
            const open = invite.status === "pending" || invite.status === "expired";
            const status = STATUS[invite.status];
            return (
              <TableRow key={invite.id}>
                <TableCell mobileLabel="Email" className="min-w-0 font-medium text-foreground">
                  <span className="min-w-0 break-all">{invite.email}</span>
                </TableCell>
                <TableCell mobileLabel="Status">
                  <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold", status.className)}>{status.label}</span>
                </TableCell>
                <TableCell mobileLabel="Last sent" className="text-muted-foreground">
                  {formatDateUS(invite.lastSentAt, { month: "short", day: "numeric" })}
                </TableCell>
                <TableCell hideBorderMobile className="md:justify-end">
                  {open && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={invite.status === "expired" ? "default" : "outline"}
                        loading={busyId === invite.id}
                        onClick={() => run(invite.id, () => resendInviteAction({ id: invite.id }), "A new invite link was sent.", "Couldn't re-send that invite.")}
                      >
                        <Send />
                        Resend
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Revoke the invite for ${invite.email}`}
                        disabled={busyId === invite.id}
                        onClick={() => run(invite.id, () => revokeInviteAction({ id: invite.id }), "Invite revoked.", "Couldn't revoke that invite.")}
                      >
                        <X />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {vault}
    </div>
  );
}
