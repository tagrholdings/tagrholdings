"use client";

import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { updateActivityAction } from "@/modules/activities/activities.actions";
import type { ActivityRow } from "@/modules/activities/activities.types";
import {
  ActivityFormFields,
  activityFormSchema,
  activityToFormValues,
  toNewActivity,
  type ActivityFormValues,
  type ActivityLookups,
} from "./activity-form";

/** Edits one activity in place (inside its detail panel). Saving replaces every field with what the form shows. */
export function ActivityEditForm({ activity, lookups, onDone }: { activity: ActivityRow; lookups: ActivityLookups; onDone: () => void }) {
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: activityToFormValues(activity),
  });
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!(await form.trigger())) return;

    setSaving(true);
    try {
      const result = await updateActivityAction({ id: activity.id, ...toNewActivity(form.getValues()) });
      if (result?.serverError || result?.validationErrors || !result?.data) {
        notify.error(result?.serverError ?? "Couldn't save your changes. Please try again.");
        return;
      }
      notify.success("Activity updated.");
      onDone();
    } catch {
      notify.error("Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <ActivityFormFields form={form} lookups={lookups} />
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
