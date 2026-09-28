"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/toaster";
import { acceptInviteAction } from "@/modules/invites/invites.actions";

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(100),
    password: z.string().min(8, "Use at least 8 characters.").max(128, "That password is too long."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match.", path: ["confirm"] });

type FormValues = z.input<typeof formSchema>;

const inputClass = "border-cream/15 bg-cream/5 text-cream placeholder:text-cream/35 focus-visible:border-accent";

/** Name + password for a valid invite link. On success the person is already signed in and lands in the app. */
export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const result = await acceptInviteAction({ token, name: values.name, password: values.password });
      if (!result?.data) {
        // A stale/used link, a refused password, a rate limit — the message is already user-safe (see safe-action.ts).
        notify.error(result?.serverError ?? "Couldn't create your account. Please try again.");
        if (result?.serverError?.includes("expired")) router.refresh(); // re-renders the page into its expired state
        return;
      }
      if (result.data.signedIn) {
        router.push("/activities");
        router.refresh();
      } else {
        notify.success("Your account is ready — sign in to continue.");
        router.push("/auth/sign-in");
      }
    } catch {
      notify.error("Couldn't create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={email} readOnly disabled aria-label="Your email" className={inputClass} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cream/40" />
          <Input id="name" autoComplete="name" placeholder="Jane Smith" aria-invalid={!!errors.name} className={`pl-9 ${inputClass}`} {...register("name")} />
        </div>
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cream/40" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            aria-invalid={!!errors.password}
            className={`pr-9 pl-9 ${inputClass}`}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-cream/40 transition-colors hover:text-cream"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cream/40" />
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={!!errors.confirm}
            className={`pl-9 ${inputClass}`}
            {...register("confirm")}
          />
        </div>
        {errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}
      </div>

      <Button type="submit" loading={submitting} className="w-full">
        Create account
      </Button>
    </form>
  );
}
