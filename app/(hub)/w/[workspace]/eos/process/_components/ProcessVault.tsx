"use client";

import { useTransition, type MouseEvent } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { ChoicePills, OwnerPicker } from "@/components/traction/traction-ui";
import { createProcessAction, deleteProcessAction, updateProcessAction } from "@/modules/traction/traction.actions";
import { PROCESS_AREAS, PROCESS_AREA_LABELS, PROCESS_STAGES, PROCESS_STAGE_LABELS, type ProcessRow, type TractionMember } from "@/modules/traction/traction.types";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name the process.").max(120),
  area: z.enum(PROCESS_AREAS),
  ownerPersonId: z.string().nullable(),
  stage: z.enum(PROCESS_STAGES),
  steps: z.array(z.object({ title: z.string().max(200), detail: z.string().max(1000) })).max(20),
});
type FormValues = z.input<typeof formSchema>;

/** A core process: a name people recognize, its area, one owner, and 5–20 major steps with just enough detail. */
export function ProcessVault({ members, process, open, onOpenChange }: { members: TractionMember[]; process?: ProcessRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [deleting, startDelete] = useTransition();
  const defaults = (): FormValues => ({
    name: process?.name ?? "",
    area: process?.area ?? "operations",
    ownerPersonId: process?.ownerPersonId ?? null,
    stage: process?.stage ?? "documented",
    steps: process?.steps.map((s) => ({ title: s.title, detail: s.detail ?? "" })) ?? [{ title: "", detail: "" }],
  });
  const { register, control, reset, trigger, getValues, setError, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults() });
  const { fields, append, remove } = useFieldArray({ control, name: "steps" });

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const v = getValues();
    const steps = v.steps.map((s) => ({ title: s.title.trim(), detail: s.detail.trim() || undefined })).filter((s) => s.title);
    if (steps.length === 0) {
      setError("steps", { message: "Add at least one step." });
      return false;
    }
    const payload = { name: v.name, area: v.area, ownerPersonId: v.ownerPersonId, stage: v.stage, steps };
    const result = process ? await updateProcessAction({ id: process.id, ...payload }) : await createProcessAction(payload);
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the process.");
      throw new Error("process save failed");
    }
  };

  function handleDelete() {
    if (!process) return;
    startDelete(async () => {
      const result = await deleteProcessAction({ id: process.id });
      if (result?.serverError) notify.error(result.serverError);
      else {
        notify.success("Process deleted.");
        onOpenChange(false);
      }
    });
  }

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults()); onOpenChange(next); }}>
      <VaultContent aria-label={process ? "Edit process" : "New process"}>
        <VaultHeader>
          <VaultTitle>{process ? "Edit process" : "New process"}</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">Just enough detail to follow it the same way every time — not a 50-page manual.</VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Name" required error={errors.name?.message}>
            <VaultInput placeholder="e.g. The Grounded Way (new customer)" {...register("name")} />
          </VaultField>
          <VaultField label="Area">
            <Controller control={control} name="area" render={({ field }) => <ChoicePills ariaLabel="Area" value={field.value} onChange={field.onChange} options={PROCESS_AREAS.map((a) => ({ value: a, label: PROCESS_AREA_LABELS[a] }))} />} />
          </VaultField>
          <VaultField label="Owner">
            <Controller control={control} name="ownerPersonId" render={({ field }) => <OwnerPicker members={members} value={field.value} onChange={field.onChange} />} />
          </VaultField>
          <VaultField label="Where it stands">
            <Controller control={control} name="stage" render={({ field }) => <ChoicePills ariaLabel="Stage" value={field.value} onChange={field.onChange} options={PROCESS_STAGES.map((s) => ({ value: s, label: PROCESS_STAGE_LABELS[s] }))} />} />
          </VaultField>
          <VaultField label="Steps (5–20)" error={errors.steps?.message ?? errors.steps?.root?.message}>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <span className="w-6 pt-2.5 text-right text-sm text-muted-foreground tabular-nums">{index + 1}.</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <VaultInput placeholder="Step" {...register(`steps.${index}.title` as const)} />
                    <VaultInput placeholder="Detail (optional)" className="text-xs" {...register(`steps.${index}.detail` as const)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label="Remove step"
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {fields.length < 20 && (
                <button
                  type="button"
                  onClick={() => append({ title: "", detail: "" })}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover"
                >
                  <Plus className="size-4" />
                  Add step
                </button>
              )}
            </div>
          </VaultField>
          {process && (
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} loading={deleting} className="self-start">
              <Trash2 />
              Delete process
            </Button>
          )}
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              {process ? "Save" : "Add process"}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
