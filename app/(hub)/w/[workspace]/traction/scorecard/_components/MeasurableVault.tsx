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

const toNumber = (v: string) => Number(v.replace(/[$,%\s]/g, ""));
const isNumber = (v: string) => v.trim() !== "" && Number.isFinite(toNumber(v));

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    ownerPersonId: z.string({ message: "Every number needs one owner." }).min(1, "Every number needs one owner."),
    cadence: z.enum(CADENCES),
    unit: z.enum(UNITS),
    aggregation: z.enum(AGGREGATIONS),
    goalOperator: z.enum(["none", "gte", "lte", "eq", "between"]),
    goalValue: z.string(),
    goalValueMax: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.goalOperator === "none") return;
    if (!isNumber(v.goalValue)) ctx.addIssue({ code: "custom", message: "Type the goal as a number.", path: ["goalValue"] });
    if (v.goalOperator === "between" && (!isNumber(v.goalValueMax) || toNumber(v.goalValueMax) < toNumber(v.goalValue))) {
      ctx.addIssue({ code: "custom", message: "Type the range low to high, like 40 and 60.", path: ["goalValue"] });
    }
  });
type FormValues = z.input<typeof formSchema>;

function toForm(m: MeasurableRow | undefined, cadence: Cadence): FormValues {
  return {
    name: m?.name ?? "",
    ownerPersonId: m?.ownerPersonId ?? "",
    cadence: m?.cadence ?? cadence,
    unit: m?.unit ?? "number",
    aggregation: m?.aggregation ?? "sum",
    goalOperator: m?.goalOperator ?? "none",
    goalValue: m?.goalValue === null || m?.goalValue === undefined ? "" : String(m.goalValue),
    goalValueMax: m?.goalValueMax === null || m?.goalValueMax === undefined ? "" : String(m.goalValueMax),
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
      ownerPersonId: v.ownerPersonId,
      cadence: v.cadence,
      unit: v.unit,
      aggregation: v.aggregation,
      goalOperator: v.goalOperator === "none" ? null : v.goalOperator,
      goalValue: v.goalOperator === "none" ? null : toNumber(v.goalValue),
      goalValueMax: v.goalOperator === "between" ? toNumber(v.goalValueMax) : null,
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
          <VaultField label="Owner" required error={errors.ownerPersonId?.message}>
            <Controller control={control} name="ownerPersonId" render={({ field }) => <OwnerPicker members={members} value={field.value || null} onChange={(id) => field.onChange(id ?? "")} required />} />
          </VaultField>
          <VaultField label="Entered every">
            <p className="text-xs text-muted-foreground">EOS runs on weekly numbers; use monthly only for numbers that don&apos;t exist weekly.</p>
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
                      { value: "between", label: "Between" },
                    ]}
                  />
                )}
              />
              {goalOperator !== "none" && <VaultInput inputMode="decimal" placeholder={goalOperator === "between" ? "From" : "13500"} aria-label="Goal" className="w-32" {...register("goalValue")} />}
              {goalOperator === "between" && <VaultInput inputMode="decimal" placeholder="To" aria-label="Goal, upper end" className="w-32" {...register("goalValueMax")} />}
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
