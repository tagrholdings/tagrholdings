"use client";

import { useState, type MouseEvent } from "react";
import { Plus } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
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
import { CommandSelect } from "@/components/shared/command-select";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { createContactAction } from "@/modules/contacts/contacts.actions";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.union([z.email("Enter a valid email address."), z.literal("")]).optional(),
  phone: z.string().optional(),
  organizationId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateContactVault({
  organizations,
  onCreateOrganization,
}: {
  organizations: { id: string; name: string }[];
  /** Creates an organization from the picker's "Create …" row and resolves with its id. */
  onCreateOrganization: (name: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const { register, control, trigger, getValues, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;

    const values = getValues();
    const result = await createContactAction({
      name: values.name.trim(),
      email: values.email || undefined,
      phone: values.phone || undefined,
      organizationId: values.organizationId || undefined,
    });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't create that contact. Please try again.");
      throw new Error("createContactAction failed");
    }
    reset();
  };

  return (
    <Vault open={open} onOpenChange={setOpen}>
      <VaultTrigger asChild>
        <Button>
          <Plus />
          New
        </Button>
      </VaultTrigger>
      <VaultContent aria-label="New contact">
        <VaultHeader>
          <VaultTitle>New contact</VaultTitle>
        </VaultHeader>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Name" required error={errors.name?.message}>
            <VaultInput placeholder="Jane Doe" {...register("name")} />
          </VaultField>

          <VaultField label="Email" error={errors.email?.message}>
            <VaultInput type="email" placeholder="jane@company.com" {...register("email")} />
          </VaultField>

          <VaultField label="Phone">
            <VaultInput type="tel" placeholder="(555) 000-0000" {...register("phone")} />
          </VaultField>

          <VaultField label="Organization">
            <Controller
              control={control}
              name="organizationId"
              render={({ field }) => (
                <CommandSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="None"
                  searchPlaceholder="Search or create an organization…"
                  options={organizations.map((org) => ({ value: org.id, label: org.name }))}
                  createLabel="Create organization"
                  onCreate={async (name) => {
                    const id = await onCreateOrganization(name);
                    if (id) setValue("organizationId", id);
                  }}
                />
              )}
            />
          </VaultField>

          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleCreate}>
              Create contact
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
