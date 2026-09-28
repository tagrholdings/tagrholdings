"use client";

import type { MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Vault,
  VaultContent,
  VaultHeader,
  VaultTitle,
  VaultDescription,
  VaultForm,
  VaultField,
  VaultInput,
  VaultFooter,
  VaultPrimaryButton,
  VaultSecondaryButton,
} from "@/components/ui/vault";
import { notify } from "@/components/ui/toaster";
import { createInviteAction } from "@/modules/invites/invites.actions";
import { INVITE_TTL_DAYS } from "@/modules/invites/invites.types";

const formSchema = z.object({ email: z.email("Enter a valid email address.") });
type FormValues = z.input<typeof formSchema>;

function InviteForm({ onClose }: { onClose: () => void }) {
  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { email: "" } });

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleSend = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const result = await createInviteAction({ email: getValues().email.trim() });
    if (!result?.data) {
      notify.error(result?.serverError ?? "Couldn't send that invite. Please try again.");
      throw new Error("createInviteAction failed");
    }
    if (result.data.resent) notify.info("That person already had an open invite — a fresh link was sent.");
  };

  return (
    <VaultForm onSubmit={(e) => e.preventDefault()}>
      <VaultField label="Email" required error={errors.email?.message}>
        <VaultInput type="email" autoComplete="off" placeholder="colleague@company.com" {...register("email")} />
      </VaultField>
      <p className="text-xs text-muted-foreground">
        They&rsquo;ll get an email with a link to choose a password and create their account. The link works once and expires in {INVITE_TTL_DAYS} days.
      </p>
      <VaultFooter>
        <VaultSecondaryButton type="button" onClick={onClose}>
          Cancel
        </VaultSecondaryButton>
        <VaultPrimaryButton type="submit" onClick={handleSend}>
          Send invite
        </VaultPrimaryButton>
      </VaultFooter>
    </VaultForm>
  );
}

export function InviteVault({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Vault open={open} onOpenChange={onOpenChange}>
      <VaultContent aria-label="Invite someone">
        <VaultHeader>
          <VaultTitle>Invite someone</VaultTitle>
          <VaultDescription>Give a teammate their own login to the CRM.</VaultDescription>
        </VaultHeader>
        {open && <InviteForm onClose={() => onOpenChange(false)} />}
      </VaultContent>
    </Vault>
  );
}
