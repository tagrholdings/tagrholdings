import { z } from "zod";
import { workspaceRoleSchema, type WorkspaceRole } from "@/modules/tenancy/tenancy.types";

export const INVITE_TTL_DAYS = 7;

export const inviteEmailSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address.")),
  role: workspaceRoleSchema.default("member"),
});

export const inviteIdSchema = z.object({ id: z.uuid() });

/** The token in the emailed link: 32 random bytes, base64url (43 chars). Bounded so junk can't be hashed at length. */
const tokenSchema = z.string().min(20).max(100);

export const inviteTokenSchema = z.object({ token: tokenSchema });

export const acceptInviteSchema = z
  .object({
    token: tokenSchema,
    name: z.string().trim().min(1, "Enter your name.").max(100),
    password: z.string().min(8, "Use at least 8 characters.").max(128, "That password is too long."),
  })
  .strict();

export type InviteStatus = "pending" | "expired" | "accepted" | "revoked";

export interface InviteRecord {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

/** Accepted and revoked win over expiry: an accepted invite isn't "expired" just because a week went by. */
export function inviteStatus(invite: InviteRecord, now: Date): InviteStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  return invite.expiresAt.getTime() > now.getTime() ? "pending" : "expired";
}

/** Client-side row shape for Settings → Invites. */
export interface InviteSummary {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: InviteStatus;
  lastSentAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/** What the accept page needs to know about a link. `masked` hides most of the address (the link alone isn't proof of who's looking). */
export type InviteLinkState =
  | { state: "valid"; email: string; workspaceName: string }
  | { state: "expired"; maskedEmail: string }
  | { state: "used" }
  | { state: "revoked" }
  | { state: "invalid" };

/** "jane.doe@example.com" → "j•••@example.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}
