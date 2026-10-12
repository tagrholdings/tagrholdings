"use client";

import { useTransition, type MouseEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Archive } from "lucide-react";
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
import { archiveMeasurableAction, createMeasurableAction, updateMeasurableAction } from "@/modules/traction/traction.actions";
import type { Cadence } from "@/modules/traction/traction.logic";
import { AGGREGATIONS, AGGREGATION_LABELS, CADENCES, CADENCE_LABELS, UNITS, UNIT_LABELS, type MeasurableRow, type TractionMember } from "@/modules/traction/traction.types";

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    ownerUserId: z.string().nullable(),
    cadence: z.enum(CADENCES),
    unit: z.enum(UNITS),
    aggregation: z.enum(AGGREGATIONS),
    goalOperator: z.enum(["none", "gte", "lte", "eq"]),
    goalValue: z.string(),
  })
  .refine((v) => v.goalOperator === "none" || (v.goalValue.trim() !== "" && Number.isFinite(Number(v.goalValue.replace(/[$,%\s]/g, "")))), {
    message: "Type the goal as a number.",
    path: ["goalValue"],
  });
type FormValues = z.input<typeof formSchema>;

function toForm(m: MeasurableRow | undefined, cadence: Cadence): FormValues {
  return {
    name: m?.name ?? "",
    ownerUserId: m?.ownerUserId ?? null,
    cadence: m?.cadence ?? cadence,
    unit: m?.unit ?? "number",
    aggregation: m?.aggregation ?? "sum",
    goalOperator: m?.goalOperator ?? "none",
    goalValue: m?.goalValue === null || m?.goalValue === undefined ? "" : String(m.goalValue),
  };
}

/** Create a Scorecard measurable, or edit/archive one (`measurable`). */
export function MeasurableVault({
  members,
  measurable,
  defaultCadence,
  open,
  onOpenChange,
}: {
  members: TractionMember[];
  measurable?: MeasurableRow;
  defaultCadence: Cadence;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [archiving, startArchive] = useTransition();
  const { register, control, reset, trigger, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toForm(measurable, defaultCadence),
  });
  const goalOperator = useWatch({ control, name: "goalOperator" });

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const v = getValues();
    const payload = {
      name: v.name,
      ownerUserId: v.ownerUserId,
      cadence: v.cadence,
      unit: v.unit,
      aggregation: v.aggregation,
      goalOperator: v.goalOperator === "none" ? null : v.goalOperator,
      goalValue: v.goalOperator === "none" ? null : Number(v.goalValue.replace(/[$,%\s]/g, "")),
    };
    const result = measurable ? await updateMeasurableAction({ id: measurable.id, ...payload }) : await createMeasurableAction(payload);
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the measurable.");
      throw new Error("measurable save failed");
    }
  };

  function handleArchive() {
    if (!measurable) return;
    startArchive(async () => {
      const result = await archiveMeasurableAction({ id: measurable.id });
      if (result?.serverError) notify.error(result.serverError);
      else {
        notify.success(`“${measurable.name}” archived. Its history is kept.`);
        onOpenChange(false);
      }
    });
  }

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(toForm(measurable, defaultCadence)); onOpenChange(next); }}>
      <VaultContent aria-label={measurable ? "Edit measurable" : "New measurable"}>
        <VaultHeader>
          <VaultTitle>{measurable ? "Edit measurable" : "New measurable"}</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">One number, one owner, one goal. Off goal shows red and can go straight to Issues.</VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Name" required error={errors.name?.message}>
            <VaultInput placeholder="e.g. Monthly revenue" {...register("name")} />
          </VaultField>
          <VaultField label="Owner">
            <Controller control={control} name="ownerUserId" render={({ field }) => <OwnerPicker members={members} value={field.value} onChange={field.onChange} />} />
          </VaultField>
          <VaultField label="Entered every">
            <Controller control={control} name="cadence" render={({ field }) => <ChoicePills ariaLabel="Cadence" value={field.value} onChange={field.onChange} options={CADENCES.map((c) => ({ value: c, label: CADENCE_LABELS[c] }))} />} />
          </VaultField>
          <VaultField label="Unit">
            <Controller control={control} name="unit" render={({ field }) => <ChoicePills ariaLabel="Unit" value={field.value} onChange={field.onChange} options={UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))} />} />
          </VaultField>
          <VaultField label="Goal" error={errors.goalValue?.message}>
            <div className="flex flex-wrap items-center gap-2">
              <Controller
                control={control}
                name="goalOperator"
                render={({ field }) => (
                  <ChoicePills
                    ariaLabel="Goal comparison"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "none", label: "No goal" },
                      { value: "gte", label: "At least" },
                      { value: "lte", label: "At most" },
                      { value: "eq", label: "Exactly" },
                    ]}
                  />
                )}
              />
              {goalOperator !== "none" && <VaultInput inputMode="decimal" placeholder="13500" className="w-36" {...register("goalValue")} />}
            </div>
          </VaultField>
          <VaultField label="Quarter column shows the">
            <Controller control={control} name="aggregation" render={({ field }) => <ChoicePills ariaLabel="Quarter roll-up" value={field.value} onChange={field.onChange} options={AGGREGATIONS.map((a) => ({ value: a, label: AGGREGATION_LABELS[a] }))} />} />
          </VaultField>
          {measurable && (
            <Button type="button" variant="destructive" size="sm" onClick={handleArchive} loading={archiving} className="self-start">
              <Archive />
              Archive measurable
            </Button>
          )}
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              {measurable ? "Save" : "Add measurable"}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
