"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/toaster";
import { renameWorkspaceAction } from "@/modules/tenancy/tenancy.actions";
import { renameWorkspaceSchema } from "@/modules/tenancy/tenancy.types";
import { z } from "zod";

const formSchema = renameWorkspaceSchema.pick({ name: true });
type FormValues = z.input<typeof formSchema>;

export function RenameWorkspaceForm({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { name } });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const result = await renameWorkspaceAction({ id, name: values.name });
      if (!result?.data) notify.error(result?.serverError ?? "Couldn't rename that workspace.");
      else {
        notify.success("Renamed.");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input id="workspace-name" autoComplete="off" aria-invalid={!!formState.errors.name} {...register("name")} />
        {formState.errors.name && <p className="text-sm text-destructive">{formState.errors.name.message}</p>}
      </div>
      <Button type="submit" loading={saving} disabled={!formState.isDirty}>
        Save
      </Button>
    </form>
  );
}
