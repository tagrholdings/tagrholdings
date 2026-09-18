"use client";

import { useState, type MouseEvent } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Vault,
  VaultTrigger,
  VaultContent,
  VaultHeader,
  VaultTitle,
  VaultForm,
  VaultFooter,
  VaultPrimaryButton,
  VaultSecondaryButton,
} from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { createActivityAction } from "@/modules/activities/activities.actions";
import type { NewActivity } from "@/modules/activities/activities.types";
import {
  ActivityFormFields,
  activityFormDefaults,
  activityFormSchema,
  toNewActivity,
  type ActivityFormValues,
  type ActivityLookups,
} from "./activity-form";

interface CreateActivityVaultProps extends Partial<ActivityLookups> {
  contacts: { id: string; name: string }[];
  /**
   * Optimistic path — the parent adds the row to its own list and runs the
   * action; must resolve on success and reject on failure (the button's
   * red/green overlay follows it). Without it, the vault calls the action itself.
   */
  onCreate?: (input: NewActivity) => Promise<void>;
}

/** Used by /activities — creates the same `activities` row the inline form inside a lead/project does. */
export function CreateActivityVault({
  contacts,
  organizations = [],
  pipelineItems = [],
  members = [],
  onCreate,
}: CreateActivityVaultProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: activityFormDefaults(),
  });

  // VaultPrimaryButton contract (see the end of components/ui/vault.tsx):
  // return false → invalid, silently stop; throw → red overlay; resolve → green overlay + close.
  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await form.trigger())) return false;

    const input = toNewActivity(form.getValues());
    if (onCreate) {
      await onCreate(input);
    } else {
      const result = await createActivityAction(input);
      if (result?.serverError || result?.validationErrors) {
        notify.error(result.serverError ?? "Couldn't create that activity. Please try again.");
        throw new Error("createActivityAction failed");
      }
    }
    form.reset(activityFormDefaults());
  };

  return (
    <Vault open={open} onOpenChange={setOpen}>
      <VaultTrigger asChild>
        <Button>
          <Plus />
          New
        </Button>
      </VaultTrigger>
      <VaultContent aria-label="New activity">
        <VaultHeader>
          <VaultTitle>New activity</VaultTitle>
        </VaultHeader>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <ActivityFormFields form={form} lookups={{ contacts, organizations, members, pipelineItems }} />

          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleCreate}>
              Create activity
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
