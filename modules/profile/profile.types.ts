import { z } from "zod";
import type { WorkspaceRole } from "@/modules/tenancy/tenancy.types";

export const displayNameSchema = z.object({
  name: z.string().trim().min(1, "Type your name.").max(120, "Up to 120 characters."),
});
export type DisplayNameInput = z.input<typeof displayNameSchema>;

export const newEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Type a valid email address."),
});
export type NewEmailInput = z.input<typeof newEmailSchema>;

export const emailCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "The code is the 6 digits in the email."),
});
export type EmailCodeInput = z.input<typeof emailCodeSchema>;

/** What changed in Neon Auth, mirrored onto the person's team entries. */
export const profileDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
  })
  .refine((d) => d.name || d.email, "Nothing to update.");
export type ProfileDetails = z.infer<typeof profileDetailsSchema>;

export interface ProfileWorkspace {
  id: string;
  slug: string;
  name: string;
  role: WorkspaceRole;
  /** Their title (cargo) on that workspace's team, set on Contacts → Team. */
  title: string | null;
}
