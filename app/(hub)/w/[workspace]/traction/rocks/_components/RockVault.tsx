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
import { SETTABLE_ROCK_STATUSES, ROCK_STATUS_LABELS, type RockActivity, type RockRow, type TractionMember } from "@/modules/traction/traction.types";
import { RockTodos } from "./RockTodos";
import { CommandSelect } from "@/components/shared/command-select";

const NO_GOAL = "__none__";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/),
  ownerPersonId: z.string({ message: "A Rock has exactly one owner." }).min(1, "A Rock has exactly one owner."),
  dueDate: z.string(),
  successCriteria: z.string().trim().min(1, "Write what done looks like, so anyone can check it.").max(2000),
  status: z.enum(SETTABLE_ROCK_STATUSES),
  isCompany: z.enum(["company", "individual"]),
  oneYearGoalId: z.string().nullable(),
});
type FormValues = z.input<typeof formSchema>;

function toForm(rock: RockRow | undefined, quarter: string): FormValues {
  return {
    title: rock?.title ?? "",
    quarter: rock?.quarter ?? quarter,
    ownerPersonId: rock?.ownerPersonId ?? "",
    dueDate: rock?.dueDate ?? quarterRange(quarter).end,
    successCriteria: rock?.successCriteria ?? "",
    status: rock && rock.status !== "rolled_over" ? rock.status : "on_track",
    isCompany: rock && !rock.isCompany ? "individual" : "company",
    oneYearGoalId: rock?.oneYearGoalId ?? null,
  };
}

/** New Rock, or edit/delete one. A new Rock is due on the last day of its quarter unless changed. */
export function RockVault({
  members,
  goals,
  rock,
  todos = [],
  defaultQuarter,
  currentQuarter,
  open,
  onOpenChange,
}: {
  members: TractionMember[];
  /** The V/TO's 1-Year Plan goals — a Rock should move one of them. */
  goals: { id: string; text: string }[];
  rock?: RockRow;
  /** The edited Rock's milestones / to-dos. */
  todos?: RockActivity[];
  defaultQuarter: string;
  currentQuarter: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
    const payload = {
      title: v.title,
      quarter: v.quarter,
      ownerPersonId: v.ownerPersonId,
      dueDate: v.dueDate || null,
      successCriteria: v.successCriteria,
      status: v.status,
      isCompany: v.isCompany === "company",
      oneYearGoalId: v.oneYearGoalId,
    };
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
        {rock && <RockTodos rockId={rock.id} ownerPersonId={rock.ownerPersonId} todos={todos} />}
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Rock" required error={errors.title?.message}>
            <VaultInput placeholder="e.g. 500 customers by July" {...register("title")} />
          </VaultField>
          <VaultField label="Owner" required error={errors.ownerPersonId?.message}>
            <Controller control={control} name="ownerPersonId" render={({ field }) => <OwnerPicker members={members} value={field.value || null} onChange={(id) => field.onChange(id ?? "")} required />} />
          </VaultField>
          <VaultField label="Rock of">
            <Controller
              control={control}
              name="isCompany"
              render={({ field }) => (
                <ChoicePills
                  ariaLabel="Company or individual"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "company", label: "The company" },
                    { value: "individual", label: "Its owner (individual)" },
                  ]}
                />
              )}
            />
          </VaultField>
          <VaultField label="Moves this 1-Year goal">
            {goals.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add goals to the 1-Year Plan (EOS → Vision) to link Rocks to them.</p>
            ) : (
              <Controller
                control={control}
                name="oneYearGoalId"
                render={({ field }) => (
                  <CommandSelect
                    value={field.value ?? undefined}
                    onChange={(v) => field.onChange(!v || v === NO_GOAL ? null : v)}
                    placeholder="Which goal does it move?"
                    options={[{ value: NO_GOAL, label: "None" }, ...goals.map((g) => ({ value: g.id, label: g.text }))]}
                  />
                )}
              />
            )}
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
          <VaultField label="Done when" required error={errors.successCriteria?.message}>
            <Textarea placeholder="e.g. 500 active customers in FieldRoutes" {...register("successCriteria")} />
          </VaultField>
          <VaultField label="Status">
            <Controller control={control} name="status" render={({ field }) => <ChoicePills ariaLabel="Status" value={field.value} onChange={field.onChange} options={SETTABLE_ROCK_STATUSES.map((s) => ({ value: s, label: ROCK_STATUS_LABELS[s] }))} />} />
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
