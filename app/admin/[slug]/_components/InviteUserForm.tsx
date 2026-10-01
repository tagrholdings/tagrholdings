"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/toaster";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { inviteToWorkspaceAction } from "@/modules/tenancy/tenancy.actions";
import type { WorkspaceRole } from "@/modules/tenancy/tenancy.types";

const formSchema = z.object({ email: z.email("Enter a valid email address.") });
type FormValues = z.input<typeof formSchema>;

/** "Create a user": invites an email to this workspace as a member or admin (the invite email names the workspace). */
export function InviteUserForm({ workspaceId, disabled }: { workspaceId: string; disabled?: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [sending, setSending] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { email: "" } });

  const onSubmit = async (values: FormValues) => {
    setSending(true);
    try {
      const result = await inviteToWorkspaceAction({ workspaceId, email: values.email, role });
      if (!result?.data) {
        notify.error(result?.serverError ?? "Couldn't send that invite.");
        return;
      }
      notify.success(result.data.resent ? "That person already had an open invite — a fresh link was sent." : "Invite sent.");
      reset();
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="min-w-0 flex-1 basis-56 space-y-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          autoComplete="off"
          placeholder="colleague@company.com"
          disabled={disabled}
          aria-invalid={!!formState.errors.email}
          {...register("email")}
        />
        {formState.errors.email && <p className="text-sm text-destructive">{formState.errors.email.message}</p>}
      </div>
      <SegmentedControl
        value={role}
        onChange={setRole}
        options={[
          { value: "member", label: "Member" },
          { value: "admin", label: "Admin" },
        ]}
      />
      <Button type="submit" loading={sending} disabled={disabled}>
        Send invite
      </Button>
      {disabled && <p className="basis-full text-xs text-muted-foreground">Restore the workspace to invite people to it.</p>}
    </form>
  );
}
