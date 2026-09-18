"use client";

import { useState, type MouseEvent } from "react";
import { Building2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Vault,
  VaultTrigger,
  VaultContent,
  VaultHeader,
  VaultTitle,
  VaultForm,
  VaultField,
  VaultInput,
  VaultFooter,
  VaultPrimaryButton,
  VaultSecondaryButton,
} from "@/components/ui/vault";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { createOrganizationAction } from "@/modules/organizations/organizations.actions";
import type { OrganizationSummary } from "@/modules/organizations/organizations.types";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  website: z.union([z.url("Enter a valid URL."), z.literal("")]).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateOrganizationVaultProps {
  /** "button" for a standalone entry point (Contacts toolbar); "link" next to a picker that already offers a quick inline create. */
  variant?: "button" | "link";
  /** Resolves once the organization exists, so a caller (e.g. a picker) can select it right away. */
  onCreated?: (organization: OrganizationSummary) => void;
}

/**
 * The full "New organization" form — name, website and notes. The quick
 * alternative is `CommandSelect`'s inline "Create ‹name›" row (name only,
 * see organizations.service.ts's `create`'s dedup-by-name) — both create the
 * same `organizations` row, this one just asks for more up front.
 */
export function CreateOrganizationVault({ variant = "button", onCreated }: CreateOrganizationVaultProps) {
  const [open, setOpen] = useState(false);
  const { register, trigger, getValues, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;

    const values = getValues();
    const result = await createOrganizationAction({
      name: values.name.trim(),
      website: values.website || undefined,
      notes: values.notes?.trim() || undefined,
    });
    if (result?.serverError || result?.validationErrors || !result?.data) {
      notify.error(result?.serverError ?? "Couldn't create that organization. Please try again.");
      throw new Error("createOrganizationAction failed");
    }
    notify.success(`Organization "${result.data.organization.name}" created.`);
    onCreated?.(result.data.organization);
    reset();
  };

  return (
    <Vault open={open} onOpenChange={setOpen}>
      <VaultTrigger asChild>
        {variant === "button" ? (
          <Button variant="outline">
            <Building2 />
            New organization
          </Button>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
          >
            <Plus className="size-3.5" />
            New organization
          </button>
        )}
      </VaultTrigger>
      <VaultContent aria-label="New organization">
        <VaultHeader>
          <VaultTitle>New organization</VaultTitle>
        </VaultHeader>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Name" required error={errors.name?.message}>
            <VaultInput placeholder="Acme Corp" {...register("name")} />
          </VaultField>

          <VaultField label="Website" error={errors.website?.message}>
            <VaultInput type="url" placeholder="https://acme.com" {...register("website")} />
          </VaultField>

          <VaultField label="Notes">
            <Textarea placeholder="Add any context…" {...register("notes")} />
          </VaultField>

          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleCreate}>
              Create organization
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
