"use client";

import { useState, type MouseEvent } from "react";
import { Plus, X } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Vault,
  VaultTrigger,
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
import { Button } from "@/components/ui/button";
import type { NewBoard } from "@/modules/pipeline/pipeline.types";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  columns: z
    .array(z.object({ label: z.string() }))
    .refine((cols) => cols.some((c) => c.label.trim().length > 0), "Add at least one stage."),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = { name: "", columns: [{ label: "To do" }, { label: "In progress" }, { label: "Done" }] };

export function CreateProjectVault({
  variant,
  onCreate,
}: {
  /** "link" in the tab bar, "button" in the empty state. */
  variant: "link" | "button";
  /** Adds the project optimistically and runs the action — resolves on success, rejects on failure. */
  onCreate: (input: NewBoard) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { register, control, reset, trigger, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "columns" });

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;

    const values = getValues();
    await onCreate({
      name: values.name.trim(),
      columns: values.columns.map((c) => ({ label: c.label.trim() })).filter((c) => c.label.length > 0),
    });
    reset(DEFAULT_VALUES);
  };

  return (
    <Vault open={open} onOpenChange={setOpen}>
      <VaultTrigger asChild>
        {variant === "button" ? (
          <Button>
            <Plus />
            New project
          </Button>
        ) : (
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New project
          </button>
        )}
      </VaultTrigger>
      <VaultContent aria-label="New project">
        <VaultHeader>
          <VaultTitle>New project</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">
          A project is its own kanban board. Stages become its columns — you can rename or archive the project later.
        </VaultDescription>

        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Name" required error={errors.name?.message}>
            <VaultInput placeholder="e.g. Vendor onboarding" {...register("name")} />
          </VaultField>

          <VaultField label="Stages" error={errors.columns?.message ?? errors.columns?.root?.message}>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <VaultInput placeholder={`Stage ${index + 1}`} {...register(`columns.${index}.label` as const)} />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label="Remove stage"
                    disabled={fields.length <= 1}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {fields.length < 10 && (
                <button
                  type="button"
                  onClick={() => append({ label: "" })}
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  + Add stage
                </button>
              )}
            </div>
          </VaultField>

          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleCreate}>
              Create project
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
