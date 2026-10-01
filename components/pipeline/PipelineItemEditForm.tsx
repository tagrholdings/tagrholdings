"use client";

import { useState, type FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { VaultField, VaultInput } from "@/components/ui/vault";
import { CommandSelect } from "@/components/shared/command-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { updatePipelineItemAction } from "@/modules/pipeline/pipeline.actions";
import type { PipelineItemRow } from "./types";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  organizationId: z.string().optional(),
  contactId: z.string().optional(),
  notes: z.string().max(10_000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Edits a lead's / project item's own details — title, organization, contact and notes — inside its detail panel. The
 * stage is not here: the panel's stage pills already move it. Saving replaces all four, so an emptied picker or
 * notes box really clears the value.
 */
export function PipelineItemEditForm({
  item,
  contacts,
  organizations,
  onDone,
}: {
  item: PipelineItemRow;
  contacts: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
  onDone: () => void;
}) {
  const {
    register,
    control,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: item.title,
      organizationId: item.organizationId ?? undefined,
      contactId: item.contactId ?? undefined,
      notes: item.notes ?? "",
    },
  });
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!(await trigger())) return;

    const values = getValues();
    setSaving(true);
    try {
      const result = await updatePipelineItemAction({
        id: item.id,
        title: values.title.trim(),
        organizationId: values.organizationId || null,
        contactId: values.contactId || null,
        notes: values.notes?.trim() || null,
      });
      if (result?.serverError || result?.validationErrors || !result?.data) {
        notify.error(result?.serverError ?? "Couldn't save your changes. Please try again.");
        return;
      }
      notify.success("Changes saved.");
      onDone();
    } catch {
      notify.error("Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <VaultField label="Title" required error={errors.title?.message}>
        <VaultInput {...register("title")} />
      </VaultField>

      <VaultField label="Organization">
        <Controller
          control={control}
          name="organizationId"
          render={({ field }) => (
            <CommandSelect
              value={field.value}
              onChange={field.onChange}
              placeholder="None"
              searchPlaceholder="Search organizations…"
              options={organizations.map((org) => ({ value: org.id, label: org.name }))}
            />
          )}
        />
      </VaultField>

      <VaultField label="Contact">
        <Controller
          control={control}
          name="contactId"
          render={({ field }) => (
            <CommandSelect
              value={field.value}
              onChange={field.onChange}
              placeholder="None"
              searchPlaceholder="Search contacts…"
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
        />
      </VaultField>

      <VaultField label="Notes">
        <Textarea placeholder="Add any context…" {...register("notes")} />
      </VaultField>

      <div className="flex justify-end gap-2 border-t border-divider pt-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
