"use client";

import { useState, type MouseEvent } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Vault,
  VaultContent,
  VaultHeader,
  VaultTitle,
  VaultDescription,
  VaultForm,
  VaultFooter,
  VaultPrimaryButton,
  VaultSecondaryButton,
} from "@/components/ui/vault";
import { formatGoal, formatValue, goalMet, periodLabel, type Cadence } from "@/modules/traction/traction.logic";
import type { MeasurableRow } from "@/modules/traction/traction.types";

const UNIT_PREFIX = { currency: "$", number: "", percent: "" } as const;
const UNIT_SUFFIX = { currency: "", number: "", percent: "%" } as const;

const isBlankOrNumber = (v: string) => v.trim() === "" || Number.isFinite(Number(v.replace(/[$,%\s]/g, "")));
const formSchema = z.object({
  rows: z.array(z.object({ measurableId: z.string(), value: z.string().refine(isBlankOrNumber, "Type a number.") })),
});
type FormValues = z.input<typeof formSchema>;

/** A changed cell, ready for setEntryAction: `value: null` clears it. */
export interface EntryChange {
  measurableId: string;
  periodStart: string;
  value: number | null;
}

/**
 * Enter the Scorecard's numbers for one period, one big numeric field per measurable — how a phone is actually used
 * on Monday morning. Tapping a single cell opens this with just that measurable. Only the fields that changed are
 * saved. `periods` (oldest first) lets the person step back to a period they missed.
 */
export function EntryVault({
  measurables,
  periods,
  initialPeriod,
  cadence,
  currentYear,
  valueOf,
  open,
  onOpenChange,
  onSave,
  onDropToIssues,
}: {
  measurables: MeasurableRow[];
  periods: string[];
  initialPeriod: string;
  cadence: Cadence;
  currentYear: number;
  valueOf: (measurableId: string, period: string) => number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (changes: EntryChange[]) => Promise<boolean>;
  /** Shown on a single red measurable: hand it to the L10. */
  onDropToIssues?: (measurable: MeasurableRow, period: string) => void;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const valuesFor = (p: string): FormValues => ({ rows: measurables.map((m) => ({ measurableId: m.id, value: valueOf(m.id, p)?.toString() ?? "" })) });
  const { control, register, reset, trigger, getValues, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: valuesFor(initialPeriod) });
  const { fields } = useFieldArray({ control, name: "rows" });
  const index = periods.indexOf(period);
  const single = measurables.length === 1 ? measurables[0] : null;
  const singleValue = single ? valueOf(single.id, period) : null;

  function goTo(next: string) {
    setPeriod(next);
    reset(valuesFor(next));
  }

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const changes: EntryChange[] = [];
    for (const row of getValues().rows) {
      const raw = row.value.replace(/[$,%\s]/g, "");
      const value = raw === "" ? null : Number(raw);
      if (value !== valueOf(row.measurableId, period)) changes.push({ measurableId: row.measurableId, periodStart: period, value });
    }
    if (changes.length === 0) return;
    if (!(await onSave(changes))) throw new Error("save failed");
  };

  return (
    <Vault
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setPeriod(initialPeriod);
          reset(valuesFor(initialPeriod));
        }
        onOpenChange(next);
      }}
    >
      <VaultContent aria-label={single ? single.name : "Enter numbers"}>
        <VaultHeader>
          <VaultTitle>{single ? single.name : `${periodLabel(period, cadence, currentYear)} numbers`}</VaultTitle>
        </VaultHeader>
        <div className="mb-4 flex items-center justify-between gap-2">
          <VaultDescription>{single ? (formatGoal(single, single.unit) ? `Goal ${formatGoal(single, single.unit)}` : "No goal yet") : "Leave a field empty to clear it."}</VaultDescription>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Earlier period" disabled={index <= 0} onClick={() => goTo(periods[index - 1])}>
              <ChevronLeft />
            </Button>
            <span className="min-w-14 text-center text-sm font-medium tabular-nums">{periodLabel(period, cadence, currentYear)}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Later period" disabled={index === -1 || index >= periods.length - 1} onClick={() => goTo(periods[index + 1])}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <ul className="flex flex-col gap-3">
            {fields.map((field, i) => {
              const m = measurables[i];
              return (
                <li key={field.id}>
                  <label className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatGoal(m, m.unit) ?? ""}</span>
                    </span>
                    <span className="relative">
                      {UNIT_PREFIX[m.unit] && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg text-muted-foreground">{UNIT_PREFIX[m.unit]}</span>}
                      <input
                        inputMode="decimal"
                        enterKeyHint={i === fields.length - 1 ? "done" : "next"}
                        aria-invalid={!!errors.rows?.[i]?.value}
                        className={cn(
                          "h-12 w-full rounded-md border border-divider bg-surface px-3 text-right text-lg tabular-nums outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
                          UNIT_PREFIX[m.unit] && "pl-7",
                          UNIT_SUFFIX[m.unit] && "pr-8"
                        )}
                        {...register(`rows.${i}.value` as const)}
                      />
                      {UNIT_SUFFIX[m.unit] && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-lg text-muted-foreground">{UNIT_SUFFIX[m.unit]}</span>}
                    </span>
                    {errors.rows?.[i]?.value && <span className="text-xs text-destructive">{errors.rows[i]?.value?.message}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
          {single && onDropToIssues && goalMet(single, singleValue) === false && (
            <Button type="button" variant="outline" className="self-start" onClick={() => { onDropToIssues(single, period); onOpenChange(false); }}>
              <CircleAlert />
              Off goal ({formatValue(singleValue, single.unit)}) · Drop to Issues
            </Button>
          )}
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              Save
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
