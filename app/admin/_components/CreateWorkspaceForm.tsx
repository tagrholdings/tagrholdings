"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/toaster";
import { createWorkspaceAction } from "@/modules/tenancy/tenancy.actions";
import { createWorkspaceWithAdminSchema, slugify, type CreateWorkspaceWithAdminInput } from "@/modules/tenancy/tenancy.types";

/** Name → slug is suggested as you type; the slug stays editable until you touch it. */
export function CreateWorkspaceForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const { register, handleSubmit, setValue, reset, formState } = useForm<CreateWorkspaceWithAdminInput>({
    resolver: zodResolver(createWorkspaceWithAdminSchema),
    defaultValues: { name: "", slug: "", adminEmail: "" },
  });

  const onSubmit = async (values: CreateWorkspaceWithAdminInput) => {
    setSaving(true);
    try {
      const result = await createWorkspaceAction({ ...values, adminEmail: values.adminEmail?.trim() || undefined });
      if (!result?.data) {
        notify.error(result?.serverError ?? "Couldn't create that workspace. Please try again.");
        return;
      }
      notify.success(`Created ${result.data.workspace.name}.`);
      if (result.data.inviteWarning) notify.error(result.data.inviteWarning);
      reset();
      setSlugTouched(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          autoComplete="off"
          placeholder="Menlo CRE"
          aria-invalid={!!formState.errors.name}
          {...register("name", {
            onChange: (event) => {
              if (!slugTouched) setValue("slug", slugify(event.target.value), { shouldValidate: formState.isSubmitted });
            },
          })}
        />
        {formState.errors.name && <p className="text-sm text-destructive">{formState.errors.name.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Address</Label>
        <Input
          id="slug"
          autoComplete="off"
          placeholder="menlo-cre"
          aria-invalid={!!formState.errors.slug}
          {...register("slug", { onChange: () => setSlugTouched(true) })}
        />
        {formState.errors.slug ? (
          <p className="text-sm text-destructive">{formState.errors.slug.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Used in the URL: /w/…</p>
        )}
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="adminEmail">First admin&rsquo;s email (optional)</Label>
        <Input id="adminEmail" type="email" autoComplete="off" placeholder="owner@company.com" aria-invalid={!!formState.errors.adminEmail} {...register("adminEmail")} />
        {formState.errors.adminEmail && <p className="text-sm text-destructive">{formState.errors.adminEmail.message}</p>}
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={saving}>
          Create workspace
        </Button>
      </div>
    </form>
  );
}
