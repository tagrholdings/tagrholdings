"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
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
import { notify } from "@/components/ui/toaster";
import { createIssueAction, resolveIssueAction, updateIssueAction } from "@/modules/traction/traction.actions";
import {
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  OUTCOMES_BY_TYPE,
  type IssueHorizon,
  type IssueOutcome,
  type IssueRow,
  type IssueType,
  type TractionMember,
} from "@/modules/traction/traction.types";
import { ChoicePills, OwnerPicker } from "./traction-ui";

const HORIZON_OPTIONS: { value: IssueHorizon; label: string }[] = [
  { value: "short_term", label: "This week (L10)" },
  { value: "long_term", label: "Long term (V/TO)" },
];

/** How each kind of issue is handled in IDS — shown under the kind picker. */
export const ISSUE_TYPE_HINTS: Record<IssueType, string> = {
  problem: "Something going wrong. IDS finds the root cause and solves it.",
  idea: "Something new to try. IDS decides: yes, no, or later.",
  obstacle: "Something blocking a Rock or a goal. IDS removes it, or escalates it.",
};

const issueFormSchema = z.object({
  title: z.string().trim().min(1, "Describe the issue.").max(200),
  issueType: z.enum(ISSUE_TYPES),
  rootCause: z.string().max(500),
  notes: z.string().max(5000),
  horizon: z.enum(["short_term", "long_term"]),
  ownerPersonId: z.string().nullable(),
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
    issueType: issue?.issueType ?? "problem",
    rootCause: issue?.rootCause ?? "",
    notes: issue?.notes ?? "",
    horizon: issue?.horizon ?? defaultHorizon,
    ownerPersonId: issue?.ownerPersonId ?? null,
  };
  const { register, control, reset, trigger: validate, getValues, formState: { errors } } = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: defaults,
  });
  const issueType = useWatch({ control, name: "issueType" });

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await validate())) return false;
    const v = getValues();
    const payload = { title: v.title, issueType: v.issueType, rootCause: v.rootCause || null, notes: v.notes || null, horizon: v.horizon, ownerPersonId: v.ownerPersonId };
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
        <VaultDescription className="mb-4">Anything in the way. The L10 ranks the list and solves the top three, one at a time.</VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Issue" required error={errors.title?.message}>
            <VaultInput placeholder="e.g. Not enough referral partners" {...register("title")} />
          </VaultField>
          <VaultField label="Kind">
            <Controller
              control={control}
              name="issueType"
              render={({ field }) => <ChoicePills ariaLabel="Kind" value={field.value} onChange={field.onChange} options={ISSUE_TYPES.map((t) => ({ value: t, label: ISSUE_TYPE_LABELS[t] }))} />}
            />
            <p className="text-xs text-muted-foreground">{ISSUE_TYPE_HINTS[issueType]}</p>
          </VaultField>
          <VaultField label="The real issue, in one sentence" error={errors.rootCause?.message}>
            <VaultInput placeholder="Ask why until it's the root cause, not the symptom" {...register("rootCause")} />
            <p className="text-xs text-muted-foreground">Can be filled in during IDS (Identify).</p>
          </VaultField>
          <VaultField label="Details">
            <Textarea placeholder="Optional context" {...register("notes")} />
          </VaultField>
          <VaultField label="List">
            <Controller control={control} name="horizon" render={({ field }) => <ChoicePills ariaLabel="List" value={field.value} onChange={field.onChange} options={HORIZON_OPTIONS} />} />
          </VaultField>
          <VaultField label="Owner">
            <Controller control={control} name="ownerPersonId" render={({ field }) => <OwnerPicker members={members} value={field.value} onChange={field.onChange} />} />
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

const OUTCOME_LABELS: Record<IssueOutcome, string> = {
  solved: "Solved",
  yes: "Yes, do it",
  no: "No",
  later: "Later (long-term list)",
  removed: "Removed",
  escalated: "Escalate (long-term list)",
};
const ACTS: IssueOutcome[] = ["solved", "yes", "removed"];

/** Seven days out — an L10 To-Do is a one-week commitment. */
function inAWeek() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const resolveFormSchema = z
  .object({
    outcome: z.enum(["solved", "yes", "no", "later", "removed", "escalated"]),
    solution: z.string().max(2000),
    todos: z.array(z.object({ subject: z.string().max(200), owner: z.string().nullable(), due: z.string() })).max(10),
  })
  .superRefine((v, ctx) => {
    if (!ACTS.includes(v.outcome)) return;
    v.todos.forEach((t, i) => {
      if (!t.subject.trim()) ctx.addIssue({ code: "custom", message: "Write the To-Do, or remove it.", path: ["todos", i, "subject"] });
      if (!t.owner) ctx.addIssue({ code: "custom", message: "Every To-Do needs one owner.", path: ["todos", i, "owner"] });
    });
  });
type ResolveFormValues = z.input<typeof resolveFormSchema>;

/**
 * IDS → Solve, by kind. A problem is solved; an idea gets yes / no / later; an obstacle is removed or escalated.
 * Acting on it (solved, yes, removed) records the decision and its action items — who + what + when, as many as it
 * takes. "Later" and "escalate" move it to the long-term list for the quarterly.
 */
export function ResolveIssueVault({ issue, members, open, onOpenChange }: { issue: IssueRow | null; members: TractionMember[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const outcomes = issue ? OUTCOMES_BY_TYPE[issue.issueType] : (["solved"] as IssueOutcome[]);
  const defaults = (): ResolveFormValues => ({ outcome: outcomes[0], solution: "", todos: [{ subject: "", owner: issue?.ownerPersonId ?? null, due: inAWeek() }] });
  const { register, control, reset, trigger, getValues, formState: { errors } } = useForm<ResolveFormValues>({
    resolver: zodResolver(resolveFormSchema),
    defaultValues: defaults(),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "todos" });
  const outcome = useWatch({ control, name: "outcome" });
  const acts = ACTS.includes(outcome);

  const handleResolve = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!issue || !(await trigger())) return false;
    const v = getValues();
    const result = await resolveIssueAction({
      id: issue.id,
      outcome: v.outcome,
      solution: v.solution || null,
      // Noon local time, so the due day never slips across a timezone boundary.
      todos: acts ? v.todos.filter((t) => t.subject.trim()).map((t) => ({ subject: t.subject, assignedToPersonId: t.owner!, dueDate: t.due ? new Date(`${t.due}T12:00:00`) : null })) : [],
    });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't resolve the issue. Please try again.");
      throw new Error("resolve failed");
    }
  };

  const verb = issue?.issueType === "idea" ? "Decide" : issue?.issueType === "obstacle" ? "Remove or escalate" : "Solve";

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults()); onOpenChange(next); }}>
      <VaultContent aria-label={verb}>
        <VaultHeader>
          <VaultTitle>{verb}</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">
          {issue?.rootCause ? (
            <>
              <span className="block font-medium text-foreground">{issue.rootCause}</span>
              <span className="block text-xs">{issue.title}</span>
            </>
          ) : (
            issue?.title
          )}
        </VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          {outcomes.length > 1 && (
            <VaultField label="Decision">
              <Controller control={control} name="outcome" render={({ field }) => <ChoicePills ariaLabel="Decision" value={field.value} onChange={field.onChange} options={outcomes.map((o) => ({ value: o, label: OUTCOME_LABELS[o] }))} />} />
            </VaultField>
          )}
          <VaultField label={acts ? "What the team decided" : "Why"}>
            <Textarea placeholder={acts ? "The solution, in a sentence or two" : "Optional"} {...register("solution")} />
          </VaultField>
          {acts && (
            <VaultField label="To-Dos (who + what + when)">
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-2 rounded-md border border-divider p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <VaultInput placeholder="What" {...register(`todos.${index}.subject` as const)} />
                        {errors.todos?.[index]?.subject && <p className="mt-1 text-xs text-destructive">{errors.todos[index]?.subject?.message}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        aria-label="Remove To-Do"
                        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                      <div>
                        <Controller control={control} name={`todos.${index}.owner` as const} render={({ field: f }) => <OwnerPicker members={members} value={f.value} onChange={f.onChange} placeholder="Who" required />} />
                        {errors.todos?.[index]?.owner && <p className="mt-1 text-xs text-destructive">{errors.todos[index]?.owner?.message}</p>}
                      </div>
                      <VaultInput type="date" aria-label="When" {...register(`todos.${index}.due` as const)} />
                    </div>
                  </div>
                ))}
                {fields.length < 10 && (
                  <button
                    type="button"
                    onClick={() => append({ subject: "", owner: null, due: inAWeek() })}
                    className="inline-flex items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover"
                  >
                    <Plus className="size-4" />
                    Add To-Do
                  </button>
                )}
              </div>
            </VaultField>
          )}
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleResolve}>
              {OUTCOME_LABELS[outcome]}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
