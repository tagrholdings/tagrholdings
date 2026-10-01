"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/toaster";
import { updateBuyerIdentityAction } from "@/modules/tenancy/tenancy.actions";
import { buyerIdentitySchema, type BuyerIdentityInput } from "@/modules/tenancy/tenancy.types";

export function WorkspacePanel({ name, inboundAddress, buyer }: { name: string; inboundAddress: string | null; buyer: Required<BuyerIdentityInput> }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState } = useForm<BuyerIdentityInput>({ resolver: zodResolver(buyerIdentitySchema), defaultValues: buyer });

  async function copyAddress() {
    if (!inboundAddress) return;
    try {
      await navigator.clipboard.writeText(inboundAddress);
      notify.success("Address copied.");
    } catch {
      notify.error("Couldn't copy — select it and copy by hand.");
    }
  }

  const onSubmit = async (values: BuyerIdentityInput) => {
    setSaving(true);
    try {
      const result = await updateBuyerIdentityAction(values);
      if (!result?.data) notify.error(result?.serverError ?? "Couldn't save that. Please try again.");
      else notify.success("Saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <section data-tour="workspace-address" className="rounded-lg border border-divider bg-surface p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Mail className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-semibold text-foreground">{name}&rsquo;s leads inbox</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Anything sent to this address becomes leads in <strong>this workspace only</strong>. It is also the address the engine signs up to listing sites with.
            </p>
            {inboundAddress ? (
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-divider bg-background px-3 py-2 text-sm">{inboundAddress}</code>
                <Button type="button" size="icon-sm" variant="outline" aria-label="Copy the address" onClick={copyAddress}>
                  <Copy />
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">The inbound email domain isn&rsquo;t configured yet (INBOUND_EMAIL_DOMAIN).</p>
            )}
          </div>
        </div>
      </section>

      <form data-tour="workspace-buyer" onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-divider bg-surface p-5" noValidate>
        <h2 className="font-serif text-lg font-semibold text-foreground">Who the engine signs up as</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Listing sites ask for a name, phone and company when you subscribe to their alerts. These are used for this workspace&rsquo;s signups.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="buyerName">Name</Label>
            <Input id="buyerName" autoComplete="off" {...register("buyerName")} />
            {formState.errors.buyerName && <p className="text-sm text-destructive">{formState.errors.buyerName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerPhone">Phone</Label>
            <Input id="buyerPhone" autoComplete="off" {...register("buyerPhone")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerCompany">Company</Label>
            <Input id="buyerCompany" autoComplete="off" {...register("buyerCompany")} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
