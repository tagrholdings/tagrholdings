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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NewPipelineItem } from "@/modules/pipeline/pipeline.types";
import type { BoardColumn } from "./types";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  stage: z.string().min(1),
  contactId: z.string().optional(),
  organizationId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreatePipelineItemVault({
  boardId,
  columns,
  contacts,
  organizations,
  itemNoun,
  onCreate,
}: {
  boardId: string;
  columns: BoardColumn[];
  contacts: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
  /** "lead" on /leads-inbox, "item" on a project board. */
  itemNoun: string;
  /** Adds the item optimistically and runs the action — resolves on success, rejects on failure. */
  onCreate: (input: NewPipelineItem) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { register, control, trigger, getValues, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { stage: columns[0]?.id },
  });

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;

    const values = getValues();
    await onCreate({
      boardId,
      title: values.title.trim(),
      stage: values.stage,
      contactId: values.contactId || undefined,
      organizationId: values.organizationId || undefined,
      notes: values.notes?.trim() || undefined,
    });
    reset({ stage: columns[0]?.id });
  };

  return (
    <Vault open={open} onOpenChange={setOpen}>
      <VaultTrigger asChild>
        <Button>
          <Plus />
          New {itemNoun}
        </Button>
      </VaultTrigger>
      <VaultContent aria-label={`New ${itemNoun}`}>
        <VaultHeader>
          <VaultTitle>New {itemNoun}</VaultTitle>
        </VaultHeader>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Title" required error={errors.title?.message}>
            <VaultInput placeholder="Acme Corp — Q2 renewal" {...register("title")} />
          </VaultField>

          <VaultField label="Stage" required>
            <Controller
              control={control}
              name="stage"
              render={({ field }) => (
                <div className="flex flex-wrap gap-1.5">
                  {columns.map((column) => (
                    <button
                      key={column.id}
                      type="button"
                      aria-pressed={field.value === column.id}
                      onClick={() => field.onChange(column.id)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        field.value === column.id
                          ? "border-accent bg-accent text-ink"
                          : "border-divider bg-surface text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {column.label}
                    </button>
                  ))}
                </div>
              )}
            />
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
                  searchPlaceholder="Search organizations…"
                  options={organizations.map((org) => ({ value: org.id, label: org.name }))}
                />
              )}
            />
          </VaultField>

          <VaultField label="Contact">
            <Controller
              control={control}
              name="contactId"
              render={({ field }) => (
                <CommandSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="None"
                  searchPlaceholder="Search contacts…"
                  options={contacts.map((c) => ({ value: c.id, label: c.name }))}
                />
              )}
            />
          </VaultField>

          <VaultField label="Notes">
            <Textarea placeholder="Add any context…" {...register("notes")} />
          </VaultField>

          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleCreate}>
              Create {itemNoun}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
