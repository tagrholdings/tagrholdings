"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
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
import { ChoicePills } from "@/components/traction/traction-ui";
import { addTemplateItemAction, applyTemplateToAllAction, deleteTemplateItemAction, updateTemplateItemAction } from "@/modules/portfolio/portfolio.actions";
import type { TemplateRow } from "@/modules/portfolio/portfolio.types";
import { formatGoal } from "@/modules/traction/traction.logic";
import { AGGREGATIONS, AGGREGATION_LABELS, CADENCES, CADENCE_LABELS, UNITS, UNIT_LABELS } from "@/modules/traction/traction.types";

/** The super admin's standard Scorecard: what every company reports. Applying it copies the missing ones in. */
export function TemplateEditor({ template }: { template: TemplateRow[] }) {
  const [vault, setVault] = useState<{ open: boolean; item?: TemplateRow }>({ open: false });
  const [applying, startApplying] = useTransition();
  const [, startTransition] = useTransition();

  function apply() {
    startApplying(async () => {
      const result = await applyTemplateToAllAction({});
      if (result?.serverError) notify.error(result.serverError);
      else {
        const results = result?.data?.results ?? [];
        const added = results.reduce((sum, r) => sum + r.added, 0);
        notify.success(added ? `Added ${added} measurable(s) across ${results.filter((r) => r.added).length} workspace(s).` : "Every workspace already has the full standard Scorecard.");
      }
    });
  }

  function remove(item: TemplateRow) {
    startTransition(async () => {
      const result = await deleteTemplateItemAction({ id: item.id });
      if (result?.serverError) notify.error(result.serverError);
      else notify.success(`“${item.name}” removed from the standard. Companies keep their own copy.`);
    });
  }

  return (
    <section className="rounded-lg border border-divider bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-divider px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg font-semibold">Standard Scorecard</h2>
          <p className="text-sm text-muted-foreground">The numbers every company reports, so they compare side by side. Each company owns its copy and sets its owner.</p>
        </div>
        <Button variant="outline" onClick={() => setVault({ open: true })}>
          <Plus />
          Add
        </Button>
        <Button onClick={apply} loading={applying} disabled={template.length === 0}>
          Apply to every workspace
        </Button>
      </div>
      {template.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No standard measurables yet. Typical ones: revenue, P&amp;L, new customers, active customers, aging AR.</p>
      ) : (
        <ul>
          {template.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 border-b border-divider/50 px-4 py-2.5 text-sm last:border-0">
              <span className="min-w-0 flex-1 font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {CADENCE_LABELS[item.cadence]} · {UNIT_LABELS[item.unit]} · quarter {AGGREGATION_LABELS[item.aggregation].toLowerCase()}
                {formatGoal(item, item.unit) ? ` · suggested goal ${formatGoal(item, item.unit)}` : ""}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.name}`} onClick={() => setVault({ open: true, item })}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.name}`} onClick={() => remove(item)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <TemplateVault item={vault.item} open={vault.open} onOpenChange={(open) => setVault((v) => ({ ...v, open }))} />
    </section>
  );
}

const toNumber = (v: string) => Number(v.replace(/[$,%\s]/g, ""));
const isNumber = (v: string) => v.trim() !== "" && Number.isFinite(toNumber(v));

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Name the measurable.").max(120),
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
      ctx.addIssue({ code: "custom", message: "Type the range low to high.", path: ["goalValue"] });
    }
  });
type FormValues = z.input<typeof formSchema>;

function TemplateVault({ item, open, onOpenChange }: { item?: TemplateRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const defaults = (): FormValues => ({
    name: item?.name ?? "",
    cadence: item?.cadence ?? "weekly",
    unit: item?.unit ?? "number",
    aggregation: item?.aggregation ?? "sum",
    goalOperator: item?.goalOperator ?? "none",
    goalValue: item?.goalValue === null || item?.goalValue === undefined ? "" : String(item.goalValue),
    goalValueMax: item?.goalValueMax === null || item?.goalValueMax === undefined ? "" : String(item.goalValueMax),
  });
  const { register, control, reset, trigger, getValues, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults() });
  const goalOperator = useWatch({ control, name: "goalOperator" });

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const v = getValues();
    const payload = {
      name: v.name,
      cadence: v.cadence,
      unit: v.unit,
      aggregation: v.aggregation,
      goalOperator: v.goalOperator === "none" ? null : v.goalOperator,
      goalValue: v.goalOperator === "none" ? null : toNumber(v.goalValue),
      goalValueMax: v.goalOperator === "between" ? toNumber(v.goalValueMax) : null,
    };
    const result = item ? await updateTemplateItemAction({ id: item.id, ...payload }) : await addTemplateItemAction(payload);
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the measurable.");
      throw new Error("template save failed");
    }
  };

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults()); onOpenChange(next); }}>
      <VaultContent aria-label={item ? "Edit standard measurable" : "New standard measurable"}>
        <VaultHeader>
          <VaultTitle>{item ? "Edit standard measurable" : "New standard measurable"}</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">Use the same name everywhere: the Portfolio matches each company&apos;s measurable by its name.</VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Name" required error={errors.name?.message}>
            <VaultInput placeholder="e.g. Weekly revenue" {...register("name")} />
          </VaultField>
          <VaultField label="Entered every">
            <Controller control={control} name="cadence" render={({ field }) => <ChoicePills ariaLabel="Cadence" value={field.value} onChange={field.onChange} options={CADENCES.map((c) => ({ value: c, label: CADENCE_LABELS[c] }))} />} />
          </VaultField>
          <VaultField label="Unit">
            <Controller control={control} name="unit" render={({ field }) => <ChoicePills ariaLabel="Unit" value={field.value} onChange={field.onChange} options={UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))} />} />
          </VaultField>
          <VaultField label="Quarter column shows the">
            <Controller control={control} name="aggregation" render={({ field }) => <ChoicePills ariaLabel="Quarter roll-up" value={field.value} onChange={field.onChange} options={AGGREGATIONS.map((a) => ({ value: a, label: AGGREGATION_LABELS[a] }))} />} />
          </VaultField>
          <VaultField label="Suggested goal" error={errors.goalValue?.message}>
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
                      { value: "none", label: "None" },
                      { value: "gte", label: "At least" },
                      { value: "lte", label: "At most" },
                      { value: "eq", label: "Exactly" },
                      { value: "between", label: "Between" },
                    ]}
                  />
                )}
              />
              {goalOperator !== "none" && <VaultInput inputMode="decimal" aria-label="Goal" className="w-32" {...register("goalValue")} />}
              {goalOperator === "between" && <VaultInput inputMode="decimal" aria-label="Goal, upper end" className="w-32" {...register("goalValueMax")} />}
            </div>
          </VaultField>
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              {item ? "Save" : "Add"}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
