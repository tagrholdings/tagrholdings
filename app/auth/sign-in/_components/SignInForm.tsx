"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, type Variants } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
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

interface SignInFormProps {
  /** Entrance variants for each field — driven by SignInCard's stagger. */
  fieldVariants?: Variants;
}

export function SignInForm({ fieldVariants }: SignInFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      <motion.div variants={fieldVariants} className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            className="pl-9"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </motion.div>

      <motion.div variants={fieldVariants} className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={!!errors.password}
            className="pr-9 pl-9"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-ink"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </motion.div>

      <motion.div variants={fieldVariants}>
        <Button type="submit" loading={isSubmitting} className="w-full">
          Sign in
          {!isSubmitting && <ArrowRight className="size-4" />}
        </Button>
      </motion.div>
    </form>
  );
}
