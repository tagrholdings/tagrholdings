"use client";

import type { MouseEvent } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/toaster";
import { createEmailSourceAction, updateEmailSourceAction } from "@/modules/email-sources/email-sources.actions";
import type { EmailSourceSummary } from "@/modules/email-sources/email-sources.types";

const formSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required.").max(200),
  signupUrl: z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL." }).max(2048),
  emailFieldSelector: z.string().trim().max(300),
  submitSelector: z.string().trim().max(300),
  captchaProtected: z.boolean(),
  notes: z.string().trim().max(5000),
});
type FormValues = z.input<typeof formSchema>;

function SourceForm({ source, onClose }: { source: EmailSourceSummary | null; onClose: () => void }) {
  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siteName: source?.siteName ?? "",
      signupUrl: source?.signupUrl ?? "",
      emailFieldSelector: source?.emailFieldSelector ?? "",
      submitSelector: source?.submitSelector ?? "",
      captchaProtected: source?.captchaProtected ?? false,
      notes: source?.notes ?? "",
    },
  });

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const v = getValues();
    const data = {
      siteName: v.siteName.trim(),
      signupUrl: v.signupUrl.trim(),
      emailFieldSelector: v.emailFieldSelector.trim() || null,
      submitSelector: v.submitSelector.trim() || null,
      captchaProtected: v.captchaProtected,
      notes: v.notes.trim() || null,
    };
    const result = source ? await updateEmailSourceAction({ id: source.id, ...data }) : await createEmailSourceAction(data);
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save that site. Please try again.");
      throw new Error("email source action failed");
    }
  };

  return (
    <VaultForm onSubmit={(e) => e.preventDefault()}>
      <VaultField label="Site name" required error={errors.siteName?.message}>
        <VaultInput placeholder="BizBuySell weekly listings" {...register("siteName")} />
      </VaultField>

      <VaultField label="Signup page URL" required error={errors.signupUrl?.message}>
        <VaultInput type="url" placeholder="https://www.example.com/newsletter" {...register("signupUrl")} />
      </VaultField>

      <fieldset className="space-y-3 rounded-lg border border-divider p-3">
        <legend className="px-1 text-sm font-medium text-foreground">Automatic signup (optional)</legend>
        <p className="text-xs text-muted-foreground">
          To let the engine fill in this site&rsquo;s form, give it the CSS selectors of the email box and the submit button (right-click the field → Inspect).
          Leave both blank to sign up by hand. The engine never solves or bypasses a captcha.
        </p>
        <VaultField label="Email field selector" error={errors.emailFieldSelector?.message}>
          <VaultInput placeholder='input[type="email"]' {...register("emailFieldSelector")} />
        </VaultField>
        <VaultField label="Submit button selector" error={errors.submitSelector?.message}>
          <VaultInput placeholder='button[type="submit"]' {...register("submitSelector")} />
        </VaultField>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" {...register("captchaProtected")} />
          <span>
            <span className="block font-medium text-foreground">This form has a captcha</span>
            <span className="block text-xs text-muted-foreground">The engine will skip it — sign up by hand, then mark it subscribed.</span>
          </span>
        </label>
      </fieldset>

      <VaultField label="Notes" error={errors.notes?.message}>
        <Textarea rows={3} placeholder="Anything worth remembering about this site" {...register("notes")} />
      </VaultField>

      <VaultFooter>
        <VaultSecondaryButton type="button" onClick={onClose}>
          Cancel
        </VaultSecondaryButton>
        <VaultPrimaryButton type="submit" onClick={handleSave}>
          {source ? "Save changes" : "Add site"}
        </VaultPrimaryButton>
      </VaultFooter>
    </VaultForm>
  );
}

/** Create (source = null) or edit an email source. */
export function EmailSourceVault({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: EmailSourceSummary | null;
}) {
  return (
    <Vault open={open} onOpenChange={onOpenChange}>
      <VaultContent aria-label={source ? "Edit email source" : "Add email source"}>
        <VaultHeader>
          <VaultTitle>{source ? "Edit email source" : "Add email source"}</VaultTitle>
          <VaultDescription>A listing site that sends its listings by email.</VaultDescription>
        </VaultHeader>
        {open && <SourceForm key={source?.id ?? "new"} source={source} onClose={() => onOpenChange(false)} />}
      </VaultContent>
    </Vault>
  );
}
