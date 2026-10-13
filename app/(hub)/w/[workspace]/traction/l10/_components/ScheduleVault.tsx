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
import { notify } from "@/components/ui/toaster";
import { ChoicePills } from "@/components/traction/traction-ui";
import { saveL10ScheduleAction } from "@/modules/traction/traction.actions";
import { WEEKDAYS } from "@/modules/traction/traction.logic";

/** The zones the portfolio's companies are in, plus the browser's own — the meeting happens in the company's time. */
const TIME_ZONES = ["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Sao_Paulo", "UTC"];

const formSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time."),
  timezone: z.string().min(1),
});
type FormValues = z.input<typeof formSchema>;

/** Same day, same time, every week — and everyone is reminded an hour before (push + email, with the agenda). */
export function ScheduleVault({
  schedule,
  open,
  onOpenChange,
}: {
  schedule: { weekday: number; startTime: string; timezone: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const browserZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/Phoenix";
  const zones = [...new Set([...TIME_ZONES, browserZone, schedule?.timezone].filter(Boolean) as string[])];
  const defaults: FormValues = { weekday: schedule?.weekday ?? 2, startTime: schedule?.startTime ?? "08:00", timezone: schedule?.timezone ?? "America/Phoenix" };
  const { register, control, reset, trigger, getValues, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults });

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const result = await saveL10ScheduleAction(getValues());
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the schedule.");
      throw new Error("schedule save failed");
    }
  };

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults); onOpenChange(next); }}>
      <VaultContent aria-label="L10 schedule">
        <VaultHeader>
          <VaultTitle>Weekly L10</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">
          Same day, same time, every week. An hour before, everyone on the team gets a reminder with the meeting&apos;s points: a push on the
          app and an email.
        </VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Day">
            <Controller
              control={control}
              name="weekday"
              render={({ field }) => (
                <ChoicePills ariaLabel="Day" value={String(field.value)} onChange={(v) => field.onChange(Number(v))} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d.slice(0, 3) }))} />
              )}
            />
          </VaultField>
          <VaultField label="Time" error={errors.startTime?.message}>
            <VaultInput type="time" className="w-40" {...register("startTime")} />
          </VaultField>
          <VaultField label="Time zone">
            <select {...register("timezone")} className="h-11 w-full rounded-md border border-divider bg-surface px-3 text-sm md:h-9">
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </VaultField>
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
