"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { changeMemberRoleAction, removeMemberAction } from "@/modules/tenancy/tenancy.actions";
import type { MemberSummary, WorkspaceRole } from "@/modules/tenancy/tenancy.types";

/** Admin view of the workspace's people: change a role, or take someone out (a workspace always keeps one admin). */
export function MembersView({ members, currentUserId }: { members: MemberSummary[]; currentUserId: string }) {
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

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Admins can invite people, manage members and see the engine&rsquo;s spend. To add someone, send an invite from the Invites tab.
      </p>
      <Table data-tour="members-table">
        <TableHeader>
          <tr>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isYou = member.id === currentUserId;
            return (
              <TableRow key={member.id}>
                <TableCell mobileLabel="Name" className="min-w-0 font-medium text-foreground">
                  <span className="min-w-0 break-words">
                    {member.name || member.email}
                    {isYou && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                  </span>
                </TableCell>
                <TableCell mobileLabel="Email" className="min-w-0 text-muted-foreground">
                  <span className="min-w-0 break-all">{member.email}</span>
                </TableCell>
                <TableCell mobileLabel="Role">
                  <SegmentedControl<WorkspaceRole>
                    value={member.role}
                    onChange={(role) =>
                      run(member.id, () => changeMemberRoleAction({ userId: member.id, role }), "Role updated.", "Couldn't change that role.")
                    }
                    options={[
                      { value: "member", label: "Member" },
                      { value: "admin", label: "Admin" },
                    ]}
                  />
                </TableCell>
                <TableCell hideBorderMobile className="md:justify-end">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${member.name || member.email}`}
                    disabled={busyId === member.id}
                    onClick={() => run(member.id, () => removeMemberAction({ userId: member.id }), "Member removed.", "Couldn't remove that member.")}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
