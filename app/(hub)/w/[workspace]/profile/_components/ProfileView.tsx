"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/toaster";
import { authClient } from "@/lib/auth-client";
import { initialsFor } from "@/lib/utils";
import { workspacePath } from "@/lib/workspace-path";
import { syncProfileAction } from "@/modules/profile/profile.actions";
import {
  displayNameSchema,
  emailCodeSchema,
  newEmailSchema,
  type DisplayNameInput,
  type EmailCodeInput,
  type NewEmailInput,
  type ProfileWorkspace,
} from "@/modules/profile/profile.types";

/**
 * Neon Auth calls can reject (AuthApiError) or resolve `{ error }` — both end in a toast, never inline state
 * (see SignInForm.tsx). Resolves to true when the call went through.
 */
async function authCall(call: () => Promise<{ error?: { message?: string } | null } | undefined>, fallback: string) {
  let error: { message?: string } | null | undefined = null;
  try {
    ({ error } = (await call()) ?? {});
  } catch (caught) {
    error = { message: caught instanceof Error ? caught.message : undefined };
  }
  if (error) notify.error(error.message || fallback);
  return !error;
}

export function ProfileView({
  name,
  email,
  workspaces,
  currentSlug,
  isSuperAdmin,
}: {
  name: string;
  email: string;
  workspaces: ProfileWorkspace[];
  currentSlug: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();

  // ── Display name
  const nameForm = useForm<DisplayNameInput>({ resolver: zodResolver(displayNameSchema), defaultValues: { name } });
  const saveName = nameForm.handleSubmit(async ({ name: next }) => {
    const trimmed = next.trim();
    if (trimmed === name) return;
    if (!(await authCall(() => authClient.updateUser({ name: trimmed }), "Couldn't change your name."))) return;
    const synced = await syncProfileAction({ name: trimmed });
    if (synced?.serverError) notify.error(synced.serverError);
    notify.success("Name updated.");
    router.refresh();
  });

  // ── Email: a code goes to the NEW address, and typing it back proves the person owns it.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const emailForm = useForm<NewEmailInput>({ resolver: zodResolver(newEmailSchema), defaultValues: { email: "" } });
  const codeForm = useForm<EmailCodeInput>({ resolver: zodResolver(emailCodeSchema), defaultValues: { code: "" } });

  const sendCode = emailForm.handleSubmit(async ({ email: next }) => {
    const target = next.trim().toLowerCase();
    if (target === email.toLowerCase()) {
      notify.error("That's already your email.");
      return;
    }
    if (!(await authCall(() => authClient.emailOtp.requestEmailChange({ newEmail: target }), "Couldn't send the code. Please try again."))) return;
    setPendingEmail(target);
    codeForm.reset({ code: "" });
    notify.success(`We sent a 6-digit code to ${target}.`);
  });

  const confirmCode = codeForm.handleSubmit(async ({ code }) => {
    if (!pendingEmail) return;
    if (!(await authCall(() => authClient.emailOtp.changeEmail({ newEmail: pendingEmail, otp: code.trim() }), "That code didn't work. Check it and try again."))) return;
    const synced = await syncProfileAction({ email: pendingEmail });
    if (synced?.serverError) notify.error(synced.serverError);
    notify.success("Email changed. Use the new address to sign in from now on.");
    setPendingEmail(null);
    emailForm.reset({ email: "" });
    router.refresh();
  });

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-4 rounded-lg border border-divider bg-surface p-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink">{initialsFor(name || email)}</span>
        <div className="min-w-0">
          <p className="truncate font-serif text-xl font-semibold text-foreground">{name || email}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
          {isSuperAdmin && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent-text">
              <ShieldCheck className="size-3.5" aria-hidden />
              Platform admin — can open every workspace
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <form data-tour="profile-name" onSubmit={saveName} className="rounded-lg border border-divider bg-surface p-5" noValidate>
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
            <UserRound className="size-4" aria-hidden />
            Display name
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">How you appear to your team: the account menu, owners and assignees, the Team list of every workspace you belong to.</p>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" autoComplete="name" {...nameForm.register("name")} />
            {nameForm.formState.errors.name && <p className="text-sm text-destructive">{nameForm.formState.errors.name.message}</p>}
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" loading={nameForm.formState.isSubmitting}>
              Save name
            </Button>
          </div>
        </form>

        <section data-tour="profile-email" className="rounded-lg border border-divider bg-surface p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
            <Mail className="size-4" aria-hidden />
            Email
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You sign in with <span className="font-medium text-foreground">{email}</span>. To change it, we send a code to the new address — it only changes once you type that code here.
          </p>
          {pendingEmail ? (
            <form onSubmit={confirmCode} className="mt-4 space-y-3" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="profile-code">Code sent to {pendingEmail}</Label>
                <Input id="profile-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} {...codeForm.register("code")} />
                {codeForm.formState.errors.code && <p className="text-sm text-destructive">{codeForm.formState.errors.code.message}</p>}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setPendingEmail(null)}>
                  Use another email
                </Button>
                <Button type="submit" loading={codeForm.formState.isSubmitting}>
                  Confirm new email
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={sendCode} className="mt-4 space-y-3" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">New email</Label>
                <Input id="profile-email" type="email" autoComplete="email" placeholder="you@company.com" {...emailForm.register("email")} />
                {emailForm.formState.errors.email && <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>}
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" loading={emailForm.formState.isSubmitting}>
                  Send code
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>

      <section data-tour="profile-workspaces" className="overflow-hidden rounded-lg border border-divider bg-surface">
        <div className="border-b border-divider px-5 py-4">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
            <Building2 className="size-4" aria-hidden />
            Your workspaces
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Your role decides what you can change there; your title is set on Contacts → Team.</p>
        </div>
        {workspaces.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">You aren&rsquo;t a member of any workspace{isSuperAdmin ? " — as a platform admin you can still open all of them" : ""}.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {workspaces.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {w.name}
                    {w.slug === currentSlug && <span className="ml-2 text-xs font-normal text-muted-foreground">· you are here</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{w.title || "No title yet"}</p>
                </div>
                <span className="rounded-pill border border-divider px-2 py-0.5 text-xs font-medium capitalize text-foreground">{w.role}</span>
                {w.slug !== currentSlug && (
                  <Link href={workspacePath(w.slug, "/profile")} className="text-sm font-medium text-accent-text hover:text-accent-hover">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
