"use client";

import { useState, type MouseEvent } from "react";
import { Plus, X } from "lucide-react";
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
import { MOBILE_ICON_ONLY, MOBILE_LABEL } from "@/components/layout/page-slots";
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
  tourId,
}: CreateActivityVaultProps & {
  /** `data-tour` name for the trigger button (see components/layout/page-help.ts). */
  tourId?: string;
}) {
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

  // Closing any way but "Create" (Cancel, the X, the overlay, a swipe down) throws the draft away.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset(activityFormDefaults());
  };

  return (
    <Vault open={open} onOpenChange={handleOpenChange}>
      <VaultTrigger asChild>
        <Button variant="ghost" data-tour={tourId} aria-label="New activity" className={MOBILE_ICON_ONLY}>
          <Plus />
          <span className={MOBILE_LABEL}>New</span>
        </Button>
      </VaultTrigger>
      <VaultContent aria-label="New activity" noScroll>
        <VaultHeader className="shrink-0">
          <VaultTitle>New activity</VaultTitle>
        </VaultHeader>
        <VaultForm className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => e.preventDefault()}>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
            <ActivityFormFields form={form} lookups={{ contacts, organizations, members, pipelineItems }} collapsibleExtras />
          </div>

          <VaultFooter className="shrink-0 flex-row">
            <VaultSecondaryButton type="button" aria-label="Cancel" onClick={() => handleOpenChange(false)} className="px-4 md:px-6">
              <X className="size-5 md:hidden" aria-hidden />
              <span className="hidden md:inline">Cancel</span>
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleCreate}>
              <span className="md:hidden">Create</span>
              <span className="hidden md:inline">Create activity</span>
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
