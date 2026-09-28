"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { actionClient, protectedAction } from "@/lib/safe-action";
import { UserFacingError } from "@/lib/errors";
import { signInWithPassword } from "@/lib/auth-password";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import { getClientIp } from "@/utils/request";
import { invitesService } from "./invites.service";
import { acceptInviteSchema, inviteEmailSchema, inviteIdSchema, inviteTokenSchema } from "./invites.types";

const TOO_MANY = "Too many attempts. Please try again in a little while.";

const inviter = (user: { id: string; name?: string | null; email: string }) => ({ id: user.id, name: user.name || user.email });

// ── Settings → Invites (a signed-in team member) ──────────────────────────────────────────────────────────

export const createInviteAction = protectedAction.schema(inviteEmailSchema).action(async ({ parsedInput, ctx }) => {
  // Invites send email and create logins: cap how many one person can fire off.
  if (await rateLimitService.isLimited(`invite:user:${ctx.user.id}`, 20, 60 * 60 * 1000)) throw new UserFacingError(TOO_MANY);
  const result = await invitesService.invite(ctx.user.tenantId, inviter(ctx.user), parsedInput.email);
  revalidatePath("/settings/invites");
  return result;
});

export const resendInviteAction = protectedAction.schema(inviteIdSchema).action(async ({ parsedInput, ctx }) => {
  if (await rateLimitService.isLimited(`invite:user:${ctx.user.id}`, 20, 60 * 60 * 1000)) throw new UserFacingError(TOO_MANY);
  await invitesService.resend(ctx.user.tenantId, inviter(ctx.user), parsedInput.id);
  revalidatePath("/settings/invites");
  return { success: true };
});

export const revokeInviteAction = protectedAction.schema(inviteIdSchema).action(async ({ parsedInput, ctx }) => {
  await invitesService.revoke(ctx.user.tenantId, parsedInput.id);
  revalidatePath("/settings/invites");
  return { success: true };
});

// ── The emailed link (no session yet — the bare actionClient, like the pre-auth portal gate) ──────────────

/** Creates the account from a valid link, then signs the person in. */
export const acceptInviteAction = actionClient.schema(acceptInviteSchema).action(async ({ parsedInput }) => {
  const ip = getClientIp(await headers());
  if (await rateLimitService.isLimited(`invite-accept:ip:${ip}`, 10, 10 * 60 * 1000)) throw new UserFacingError(TOO_MANY);

  const { name, password, token } = parsedInput;
  const { email, createdAccount } = await invitesService.accept(token, { name, password });
  // Only a brand-new account has the password just chosen; an existing login keeps its own and signs in normally.
  const signedIn = createdAccount ? await signInWithPassword(email, password) : false;
  return { signedIn };
});

/** From the expired-link page: sends a fresh link to the invite's own address. */
export const requestNewInviteLinkAction = actionClient.schema(inviteTokenSchema).action(async ({ parsedInput }) => {
  const ip = getClientIp(await headers());
  if (await rateLimitService.isLimited(`invite-resend:ip:${ip}`, 5, 10 * 60 * 1000)) throw new UserFacingError(TOO_MANY);
  // Per link too, so one stale link can't be used to flood the invitee's inbox from many addresses.
  if (await rateLimitService.isLimited(`invite-resend:token:${parsedInput.token.slice(0, 16)}`, 3, 60 * 60 * 1000)) {
    throw new UserFacingError(TOO_MANY);
  }
  await invitesService.requestNewLink(parsedInput.token);
  return { success: true };
});
