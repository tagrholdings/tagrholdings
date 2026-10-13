"use client";

import type { MouseEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/toaster";
import { CommandSelect } from "@/components/shared/command-select";
import { OwnerPicker } from "@/components/traction/traction-ui";
import { createSeatAction, updateSeatAction } from "@/modules/traction/traction.actions";
import type { SeatRow, TractionMember } from "@/modules/traction/traction.types";

const TOP = "__top__";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name the seat.").max(120),
  personId: z.string().nullable(),
  parentSeatId: z.string().nullable(),
  responsibilities: z.string().max(2000).refine((v) => v.split("\n").filter((l) => l.trim()).length <= 7, "Keep it to 3–5 roles (7 at most)."),
});
type FormValues = z.input<typeof formSchema>;

/** A seat on the Accountability Chart: its name, its 3–5 roles, the seat above it, and the one person in it. */
export function SeatVault({
  seats,
  members,
  seat,
  parentSeatId,
  open,
  onOpenChange,
}: {
  seats: SeatRow[];
  members: TractionMember[];
  seat?: SeatRow;
  parentSeatId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const defaults = (): FormValues => ({
    name: seat?.name ?? "",
    personId: seat?.personId ?? null,
    parentSeatId: seat ? seat.parentSeatId : parentSeatId,
    responsibilities: seat?.responsibilities.join("\n") ?? "",
  });
  const { register, control, reset, trigger, getValues, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults() });
  // A seat can't sit under itself; the server also refuses anything under its own branch.
  const parents = seats.filter((s) => s.id !== seat?.id);

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const v = getValues();
    const payload = {
      name: v.name,
      personId: v.personId,
      parentSeatId: v.parentSeatId,
      responsibilities: v.responsibilities.split("\n").map((l) => l.trim()).filter(Boolean),
    };
    const result = seat ? await updateSeatAction({ id: seat.id, ...payload }) : await createSeatAction(payload);
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the seat.");
      throw new Error("seat save failed");
    }
  };

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults()); onOpenChange(next); }}>
      <VaultContent aria-label={seat ? "Edit seat" : "New seat"}>
        <VaultHeader>
          <VaultTitle>{seat ? "Edit seat" : "New seat"}</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">One person per seat. Shared accountability is no accountability.</VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Seat" required error={errors.name?.message}>
            <VaultInput placeholder="e.g. Integrator, Operations, Sales & Marketing" {...register("name")} />
          </VaultField>
          <VaultField label="Who sits in it">
            <Controller control={control} name="personId" render={({ field }) => <OwnerPicker members={members} value={field.value} onChange={field.onChange} placeholder="Leave empty for an open seat" />} />
          </VaultField>
          <VaultField label="Reports to">
            <Controller
              control={control}
              name="parentSeatId"
              render={({ field }) => (
                <CommandSelect
                  value={field.value ?? TOP}
                  onChange={(v) => field.onChange(!v || v === TOP ? null : v)}
                  options={[{ value: TOP, label: "Nobody (top of the chart)" }, ...parents.map((s) => ({ value: s.id, label: s.name }))]}
                />
              )}
            />
          </VaultField>
          <VaultField label="Roles (3–5, one per line)" error={errors.responsibilities?.message}>
            <Textarea placeholder={"e.g.\nLMA (lead, manage, hold accountable)\nP&L results\nExecute the business plan"} className="min-h-28" {...register("responsibilities")} />
          </VaultField>
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              {seat ? "Save" : "Add seat"}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
