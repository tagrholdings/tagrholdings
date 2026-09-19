"use client";

import type { MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { createListingSiteAction } from "@/modules/listing-sites/listing-sites.actions";
import { createListingSiteSchema } from "@/modules/listing-sites/listing-sites.types";
import type { z } from "zod";

type FormValues = z.input<typeof createListingSiteSchema>;

function SiteForm({ onClose }: { onClose: () => void }) {
  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createListingSiteSchema),
    defaultValues: { siteUrl: "", siteName: "", listingsUrl: "" },
  });

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const v = getValues();
    const result = await createListingSiteAction({
      siteUrl: v.siteUrl.trim(),
      siteName: v.siteName?.trim() || undefined,
      listingsUrl: v.listingsUrl?.trim() || undefined,
    });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't add that site. Please try again.");
      throw new Error("listing site action failed");
    }
  };

  return (
    <VaultForm onSubmit={(e) => e.preventDefault()}>
      <VaultField label="Website" required error={errors.siteUrl?.message}>
        <VaultInput type="url" placeholder="https://www.examplebrokers.com" {...register("siteUrl")} />
      </VaultField>
      <VaultField label="Name" error={errors.siteName?.message}>
        <VaultInput placeholder="Optional — the address is used when left blank" {...register("siteName")} />
      </VaultField>
      <VaultField label="Page with the listings" error={errors.listingsUrl?.message}>
        <VaultInput type="url" placeholder="Optional — the engine finds it from the homepage" {...register("listingsUrl")} />
      </VaultField>
      <VaultFooter>
        <VaultSecondaryButton type="button" onClick={onClose}>
          Cancel
        </VaultSecondaryButton>
        <VaultPrimaryButton type="submit" onClick={handleSave}>
          Add site
        </VaultPrimaryButton>
      </VaultFooter>
    </VaultForm>
  );
}

/** Add a broker's website by hand. */
export function ListingSiteVault({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Vault open={open} onOpenChange={onOpenChange}>
      <VaultContent aria-label="Add listing site">
        <VaultHeader>
          <VaultTitle>Add listing site</VaultTitle>
          <VaultDescription>A business broker&rsquo;s website. The engine reads its listings the next time a search profile with Broker listing sites runs.</VaultDescription>
        </VaultHeader>
        {open && <SiteForm onClose={() => onOpenChange(false)} />}
      </VaultContent>
    </Vault>
  );
}
