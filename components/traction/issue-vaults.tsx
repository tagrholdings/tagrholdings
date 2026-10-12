"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/components/ui/toaster";
import { createIssueAction, solveIssueAction, updateIssueAction } from "@/modules/traction/traction.actions";
import type { IssueHorizon, IssueRow, TractionMember } from "@/modules/traction/traction.types";
import { ChoicePills, OwnerPicker } from "./traction-ui";

const HORIZON_OPTIONS: { value: IssueHorizon; label: string }[] = [
  { value: "short_term", label: "This week (L10)" },
  { value: "long_term", label: "Long term (V/TO)" },
];

const issueFormSchema = z.object({
  title: z.string().trim().min(1, "Describe the issue.").max(200),
  notes: z.string().max(5000),
  horizon: z.enum(["short_term", "long_term"]),
  ownerUserId: z.string().nullable(),
});
type IssueFormValues = z.input<typeof issueFormSchema>;

/** New issue, or edit an existing one (`issue`). The trigger is the caller's (`trigger`), or none for a controlled vault. */
export function IssueVault({
  members,
  issue,
  defaultHorizon = "short_term",
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  members: TractionMember[];
  issue?: IssueRow;
  defaultHorizon?: IssueHorizon;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const defaults: IssueFormValues = {
    title: issue?.title ?? "",
    notes: issue?.notes ?? "",
    horizon: issue?.horizon ?? defaultHorizon,
    ownerUserId: issue?.ownerUserId ?? null,
  };
  const { register, control, reset, trigger: validate, getValues, formState: { errors } } = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: defaults,
  });

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await validate())) return false;
    const values = getValues();
    const payload = { title: values.title, notes: values.notes || null, horizon: values.horizon, ownerUserId: values.ownerUserId };
    const result = issue ? await updateIssueAction({ id: issue.id, ...payload }) : await createIssueAction(payload);
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the issue. Please try again.");
      throw new Error("issue save failed");
    }
    if (!issue) reset(defaults);
  };

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults); setOpen(next); }}>
      {trigger && <VaultTrigger asChild>{trigger}</VaultTrigger>}
      <VaultContent aria-label={issue ? "Edit issue" : "New issue"}>
        <VaultHeader>
          <VaultTitle>{issue ? "Edit issue" : "New issue"}</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">
          Anything in the way: a problem, an idea, an opportunity. The L10 ranks the list and solves the top three.
        </VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Issue" required error={errors.title?.message}>
            <VaultInput placeholder="e.g. Home inspectors are a channel" {...register("title")} />
          </VaultField>
          <VaultField label="Details">
            <Textarea placeholder="Optional context" {...register("notes")} />
          </VaultField>
          <VaultField label="List">
            <Controller control={control} name="horizon" render={({ field }) => <ChoicePills ariaLabel="List" value={field.value} onChange={field.onChange} options={HORIZON_OPTIONS} />} />
          </VaultField>
          <VaultField label="Owner">
            <Controller control={control} name="ownerUserId" render={({ field }) => <OwnerPicker members={members} value={field.value} onChange={field.onChange} />} />
          </VaultField>
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              {issue ? "Save" : "Add issue"}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}

const solveFormSchema = z
  .object({
    solution: z.string().max(2000),
    createTodo: z.boolean(),
    todoSubject: z.string().max(200),
    todoOwner: z.string().nullable(),
    todoDue: z.string(),
  })
  .refine((v) => !v.createTodo || v.todoSubject.trim().length > 0, { message: "Write the To-Do, or turn it off.", path: ["todoSubject"] });
type SolveFormValues = z.input<typeof solveFormSchema>;

/** Seven days out — an L10 To-Do is a one-week commitment. */
function inAWeek() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** IDS → Solve: write down the solution and the To-Do that carries it out (an L10 To-Do, linked to the issue). */
export function SolveIssueVault({ issue, members, open, onOpenChange }: { issue: IssueRow | null; members: TractionMember[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const defaults = (): SolveFormValues => ({ solution: "", createTodo: true, todoSubject: "", todoOwner: issue?.ownerUserId ?? null, todoDue: inAWeek() });
  const { register, control, reset, trigger, getValues, formState: { errors } } = useForm<SolveFormValues>({
    resolver: zodResolver(solveFormSchema),
    defaultValues: defaults(),
  });
  const createTodo = useWatch({ control, name: "createTodo" });

  const handleSolve = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!issue || !(await trigger())) return false;
    const v = getValues();
    const result = await solveIssueAction({
      id: issue.id,
      solution: v.solution || null,
      // Noon local time, so the due day never slips across a timezone boundary.
      todo: v.createTodo ? { subject: v.todoSubject, assignedToUserId: v.todoOwner, dueDate: v.todoDue ? new Date(`${v.todoDue}T12:00:00`) : null } : null,
    });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't solve the issue. Please try again.");
      throw new Error("solve failed");
    }
  };

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults()); onOpenChange(next); }}>
      <VaultContent aria-label="Solve issue">
        <VaultHeader>
          <VaultTitle>Solve issue</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">{issue?.title}</VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Solution">
            <Textarea placeholder="What did the team decide?" {...register("solution")} />
          </VaultField>
          <div className="flex items-center justify-between gap-4 rounded-md border border-divider p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Create a To-Do</p>
              <p className="text-xs text-muted-foreground">A 7-day commitment, shown in the next L10 and in Activities.</p>
            </div>
            <Controller control={control} name="createTodo" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Create a To-Do" />} />
          </div>
          {createTodo && (
            <>
              <VaultField label="To-Do" required error={errors.todoSubject?.message}>
                <VaultInput placeholder="e.g. Build a list of 20 home inspectors" {...register("todoSubject")} />
              </VaultField>
              <VaultField label="Who">
                <Controller control={control} name="todoOwner" render={({ field }) => <OwnerPicker members={members} value={field.value} onChange={field.onChange} placeholder="Who will do it?" />} />
              </VaultField>
              <VaultField label="Due">
                <VaultInput type="date" {...register("todoDue")} />
              </VaultField>
            </>
          )}
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSolve}>
              Mark solved
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
