"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const onSubmit = async (values: SignInValues) => {
    setIsSubmitting(true);

    // authClient.signIn.email() rejects with AuthApiError on bad
    // credentials instead of resolving { error } — contrary to how
    // AGENTS.md describes authClient generally. Catch it here so a failed
    // login always surfaces as a toast instead of an unhandled rejection.
    let error: { message?: string } | null = null;
    try {
      ({ error } = await authClient.signIn.email(values));
    } catch (caught) {
      error = { message: caught instanceof Error ? caught.message : undefined };
    }

    setIsSubmitting(false);

    if (error) {
      notify.error(error.message ?? "Couldn't sign in. Check your email and password.");
      return;
    }

    // "/" also works on crm.tagrholdings.com (proxy.ts rewrites it to
    // /dashboard), but going straight to /dashboard is host-agnostic —
    // it also works in local dev without a crm.localhost DNS entry.
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="signin-field space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="signin-field space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <Button type="submit" loading={isSubmitting} className="signin-field w-full">
        Sign in
      </Button>
    </form>
  );
}
