"use client";

import { useTransition, type MouseEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/toaster";
import { ChoicePills, OwnerPicker } from "@/components/traction/traction-ui";
import { createRockAction, deleteRockAction, updateRockAction } from "@/modules/traction/traction.actions";
import { planningQuarters, quarterLabel, quarterRange } from "@/modules/traction/traction.logic";
import { ROCK_STATUSES, ROCK_STATUS_LABELS, type RockRow, type TractionMember } from "@/modules/traction/traction.types";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/),
  ownerUserId: z.string().nullable(),
  dueDate: z.string(),
  successCriteria: z.string().max(2000),
  status: z.enum(ROCK_STATUSES),
});
type FormValues = z.input<typeof formSchema>;

function toForm(rock: RockRow | undefined, quarter: string): FormValues {
  return {
    title: rock?.title ?? "",
    quarter: rock?.quarter ?? quarter,
    ownerUserId: rock?.ownerUserId ?? null,
    dueDate: rock?.dueDate ?? quarterRange(quarter).end,
    successCriteria: rock?.successCriteria ?? "",
    status: rock?.status ?? "on_track",
  };
}

/** New Rock, or edit/delete one. A new Rock is due on the last day of its quarter unless changed. */
export function RockVault({ members, rock, defaultQuarter, currentQuarter, open, onOpenChange }: { members: TractionMember[]; rock?: RockRow; defaultQuarter: string; currentQuarter: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [deleting, startDelete] = useTransition();
  const { register, control, reset, trigger, getValues, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toForm(rock, defaultQuarter),
  });
  // Same quarters as the Rocks page header — an edited Rock keeps its own quarter even if it is older.
  const quarterOptions = planningQuarters(currentQuarter, [rock?.quarter ?? defaultQuarter]);

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const v = getValues();
    const payload = { title: v.title, quarter: v.quarter, ownerUserId: v.ownerUserId, dueDate: v.dueDate || null, successCriteria: v.successCriteria || null, status: v.status };
    const result = rock ? await updateRockAction({ id: rock.id, ...payload }) : await createRockAction(payload);
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the Rock.");
      throw new Error("rock save failed");
    }
  };

  function handleDelete() {
    if (!rock) return;
    startDelete(async () => {
      const result = await deleteRockAction({ id: rock.id });
      if (result?.serverError) notify.error(result.serverError);
      else {
        notify.success("Rock deleted.");
        onOpenChange(false);
      }
    });
  }

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(toForm(rock, defaultQuarter)); onOpenChange(next); }}>
      <VaultContent aria-label={rock ? "Edit Rock" : "New Rock"}>
        <VaultHeader>
          <VaultTitle>{rock ? "Edit Rock" : "New Rock"}</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">A 90-day priority: one owner, a due date and a finish line anyone could check.</VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Rock" required error={errors.title?.message}>
            <VaultInput placeholder="e.g. 500 customers by July" {...register("title")} />
          </VaultField>
          <VaultField label="Owner">
            <Controller control={control} name="ownerUserId" render={({ field }) => <OwnerPicker members={members} value={field.value} onChange={field.onChange} />} />
          </VaultField>
          <VaultField label="Quarter">
            <Controller
              control={control}
              name="quarter"
              render={({ field }) => (
                <ChoicePills
                  ariaLabel="Quarter"
                  value={field.value}
                  onChange={(q) => {
                    field.onChange(q);
                    if (!rock) setValue("dueDate", quarterRange(q).end);
                  }}
                  options={quarterOptions.map((q) => ({ value: q, label: quarterLabel(q) }))}
                />
              )}
            />
          </VaultField>
          <VaultField label="Due">
            <VaultInput type="date" {...register("dueDate")} />
          </VaultField>
          <VaultField label="Done when">
            <Textarea placeholder="e.g. 500 active customers in FieldRoutes" {...register("successCriteria")} />
          </VaultField>
          <VaultField label="Status">
            <Controller control={control} name="status" render={({ field }) => <ChoicePills ariaLabel="Status" value={field.value} onChange={field.onChange} options={ROCK_STATUSES.map((s) => ({ value: s, label: ROCK_STATUS_LABELS[s] }))} />} />
          </VaultField>
          {rock && (
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} loading={deleting} className="self-start">
              <Trash2 />
              Delete Rock
            </Button>
          )}
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              {rock ? "Save" : "Add Rock"}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
