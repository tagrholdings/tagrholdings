"use client";

import type { MouseEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
  VaultFooter,
  VaultPrimaryButton,
  VaultSecondaryButton,
} from "@/components/ui/vault";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/toaster";
import { ChoicePills } from "@/components/traction/traction-ui";
import { saveReviewAction } from "@/modules/traction/traction.actions";
import { quarterLabel, reviewVerdict } from "@/modules/traction/traction.logic";
import { VALUE_RATINGS, type ReviewRow, type TractionMember } from "@/modules/traction/traction.types";
import type { PersonRow } from "@/modules/team/team.types";

const GWC = [
  { key: "getsIt", label: "Gets it", hint: "Truly understands the seat: its roles, the culture, how it fits." },
  { key: "wantsIt", label: "Wants it", hint: "Genuinely likes the job and wants to do it, for the right pay." },
  { key: "capacity", label: "Capacity to do it", hint: "Has the time, knowledge and skill (mental, physical, emotional)." },
] as const;

const formSchema = z.object({
  /** One rating per core value, in the V/TO's order (by position, so a value name with a "." can't break the form). */
  values: z.array(z.enum(VALUE_RATINGS).nullable()),
  getsIt: z.enum(["yes", "no", ""]),
  wantsIt: z.enum(["yes", "no", ""]),
  capacity: z.enum(["yes", "no", ""]),
  notes: z.string().max(5000),
});
type FormValues = z.input<typeof formSchema>;

const fromBool = (b: boolean | null | undefined): "yes" | "no" | "" => (b === true ? "yes" : b === false ? "no" : "");
const toBool = (v: "yes" | "no" | ""): boolean | null => (v === "yes" ? true : v === "no" ? false : null);

/**
 * People Analyzer for one person and quarter: + / +- / − on each core value (right person), and yes/no on Gets it,
 * Wants it, Capacity (right seat). The bar: all "+" (one "+/-" is a conversation) and all three "yes".
 */
export function ReviewVault({
  person,
  kind,
  quarter,
  coreValues,
  existing,
  open,
  onOpenChange,
}: {
  person: PersonRow | null;
  kind: "manager" | "self";
  quarter: string;
  coreValues: string[];
  existing: ReviewRow | undefined;
  members: TractionMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const defaults = (): FormValues => ({
    values: coreValues.map((v) => (existing?.valuesRatings[v] as (typeof VALUE_RATINGS)[number] | undefined) ?? null),
    getsIt: fromBool(existing?.getsIt),
    wantsIt: fromBool(existing?.wantsIt),
    capacity: fromBool(existing?.capacity),
    notes: existing?.notes ?? "",
  });
  const { register, control, reset, getValues } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults() });
  const watched = useWatch({ control });
  const verdict = reviewVerdict(
    coreValues,
    Object.fromEntries(coreValues.flatMap((name, i) => (watched.values?.[i] ? [[name, watched.values[i] as string]] : []))),
    [toBool(watched.getsIt ?? ""), toBool(watched.wantsIt ?? ""), toBool(watched.capacity ?? "")]
  );

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!person) return false;
    const v = getValues();
    const result = await saveReviewAction({
      personId: person.id,
      quarter,
      kind,
      valuesRatings: Object.fromEntries(coreValues.flatMap((name, i) => (v.values[i] ? [[name, v.values[i]!]] : []))),
      getsIt: toBool(v.getsIt),
      wantsIt: toBool(v.wantsIt),
      capacity: toBool(v.capacity),
      notes: v.notes || null,
    });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the review.");
      throw new Error("review save failed");
    }
  };

  const yesNo = [
    { value: "yes" as const, label: "Yes" },
    { value: "no" as const, label: "No" },
  ];

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults()); onOpenChange(next); }}>
      <VaultContent aria-label="People Analyzer review">
        <VaultHeader>
          <VaultTitle>
            {kind === "self" ? "Self review" : "Review"} · {person?.name}
          </VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">
          {quarterLabel(quarter)}. Private: only {person?.name}, their manager and admins see it.
        </VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Right person: lives the core values">
            {coreValues.length === 0 ? (
              <p className="text-sm text-muted-foreground">Write the core values in EOS → Vision first.</p>
            ) : (
              <div className="space-y-2">
                {coreValues.map((value, index) => (
                  <div key={value} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">{value}</span>
                    <Controller
                      control={control}
                      name={`values.${index}` as const}
                      render={({ field }) => (
                        <ChoicePills
                          ariaLabel={value}
                          value={field.value ?? ""}
                          onChange={(v) => field.onChange(v || null)}
                          options={[
                            { value: "+", label: "+ most of the time" },
                            { value: "+/-", label: "+/− sometimes" },
                            { value: "-", label: "− rarely" },
                          ]}
                        />
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </VaultField>
          <VaultField label="Right seat: GWC">
            <div className="space-y-2">
              {GWC.map((g) => (
                <div key={g.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-sm">{g.label}</span>
                    <span className="block text-xs text-muted-foreground">{g.hint}</span>
                  </span>
                  <Controller control={control} name={g.key} render={({ field }) => <ChoicePills ariaLabel={g.label} value={field.value} onChange={field.onChange} options={yesNo} />} />
                </div>
              ))}
            </div>
          </VaultField>
          <div className="rounded-md border border-divider px-3 py-2 text-sm">
            <span className="text-muted-foreground">Right person: </span>
            <strong>{verdict.rightPerson === "yes" ? "Yes" : verdict.rightPerson === "talk" ? "One +/−: a conversation" : verdict.rightPerson === "no" ? "No" : "—"}</strong>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">Right seat: </span>
            <strong>{verdict.rightSeat === "yes" ? "Yes" : verdict.rightSeat === "no" ? "No" : "—"}</strong>
          </div>
          <VaultField label="Notes">
            <Textarea placeholder="What to talk about in the Quarterly Conversation" {...register("notes")} />
          </VaultField>
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              Save review
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
