import { createHash, randomBytes } from "node:crypto";
import { crmUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email/send";
import { inviteEmail, inviteEmailText } from "@/lib/email/templates/invite";
import { UserFacingError } from "@/lib/errors";
import { authAccountsService } from "@/modules/auth-accounts/auth-accounts.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { invitesRepository } from "./invites.repository";
import { INVITE_TTL_DAYS, inviteStatus, maskEmail, type InviteLinkState, type InviteSummary } from "./invites.types";

const DAY_MS = 24 * 60 * 60 * 1000;

const newToken = () => randomBytes(32).toString("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const expiryFrom = (now: Date) => new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);

export interface Inviter {
  id: string;
  name: string;
}

async function emailInvite(email: string, token: string, inviterName: string): Promise<boolean> {
  const acceptUrl = `${crmUrl()}/auth/accept-invite?token=${encodeURIComponent(token)}`;
  const options = { acceptUrl, inviterName, expiresInDays: INVITE_TTL_DAYS };
  return sendEmail({
    to: email,
    subject: `${inviterName} invited you to the TAGR CRM`,
    html: inviteEmail(options),
    text: inviteEmailText(options),
  });
}

export const invitesService = {
  async listForTenant(tenantId: string, now: Date = new Date()): Promise<InviteSummary[]> {
    const rows = await invitesRepository.findAllForTenant(tenantId);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      status: inviteStatus(row, now),
      lastSentAt: row.lastSentAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }));
  },

  /** Invites `email` (or re-sends the open invite it already has) and emails the link. */
  async invite(tenantId: string, inviter: Inviter, email: string, now: Date = new Date()) {
    const existingUser = await authAccountsService.findByEmail(email);
    if (existingUser && (await tenancyService.isMember(tenantId, existingUser.id))) {
      throw new UserFacingError("That person already has access.");
    }

    const token = newToken();
    const values = { tokenHash: hashToken(token), expiresAt: expiryFrom(now), now };
    const open = await invitesRepository.findOpenByEmail(tenantId, email);
    if (open) await invitesRepository.rotate(tenantId, open.id, values);
    else await invitesRepository.create(tenantId, { email, tokenHash: values.tokenHash, invitedByUserId: inviter.id, expiresAt: values.expiresAt });

    if (!(await emailInvite(email, token, inviter.name))) {
      throw new UserFacingError("The invite was saved, but the email couldn't be sent. Use Resend to try again.");
    }
    return { resent: !!open };
  },

  /** Issues a new link for an invite that is still open (pending or expired) and emails it. */
  async resend(tenantId: string, inviter: Inviter, id: string, now: Date = new Date()) {
    const invite = await invitesRepository.findById(tenantId, id);
    if (!invite || inviteStatus(invite, now) === "accepted" || inviteStatus(invite, now) === "revoked") {
      throw new UserFacingError("That invite can't be re-sent.");
    }
    const token = newToken();
    await invitesRepository.rotate(tenantId, id, { tokenHash: hashToken(token), expiresAt: expiryFrom(now), now });
    if (!(await emailInvite(invite.email, token, inviter.name))) {
      throw new UserFacingError("The email couldn't be sent. Please try again.");
    }
  },

  async revoke(tenantId: string, id: string, now: Date = new Date()) {
    if (!(await invitesRepository.revoke(tenantId, id, now))) throw new UserFacingError("That invite can't be revoked.");
  },

  /** What the accept page shows for a link. Never throws: an unknown token is just "invalid". */
  async linkState(token: string, now: Date = new Date()): Promise<InviteLinkState> {
    const invite = await invitesRepository.findByTokenHash(hashToken(token));
    if (!invite) return { state: "invalid" };
    switch (inviteStatus(invite, now)) {
      case "accepted":
        return { state: "used" };
      case "revoked":
        return { state: "revoked" };
      case "expired":
        return { state: "expired", maskedEmail: maskEmail(invite.email) };
      case "pending":
        return { state: "valid", email: invite.email };
    }
  },

  /**
   * The expired-link escape hatch: whoever holds a stale link can ask for a fresh one, which is sent to the
   * address the invite was made for — never to an address supplied here — so it can't be used to reach anyone else.
   */
  async requestNewLink(token: string, now: Date = new Date()) {
    const invite = await invitesRepository.findByTokenHash(hashToken(token));
    if (!invite) throw new UserFacingError("This invite link isn't valid.");
    const status = inviteStatus(invite, now);
    if (status === "accepted") throw new UserFacingError("This invite was already used. Try signing in.");
    if (status === "revoked") throw new UserFacingError("This invite is no longer valid. Ask for a new one.");

    const fresh = newToken();
    const rotated = await invitesRepository.rotateById(invite.id, { tokenHash: hashToken(fresh), expiresAt: expiryFrom(now), now });
    if (!rotated) throw new UserFacingError("This invite is no longer valid. Ask for a new one.");
    const inviterName = (await authAccountsService.nameOf(invite.invitedByUserId)) ?? "A teammate";
    if (!(await emailInvite(invite.email, fresh, inviterName))) {
      throw new UserFacingError("We couldn't send the email right now. Please try again in a few minutes.");
    }
  },

  /**
   * Turns a valid link into an account. The invite is claimed first (atomically, so it can't be used twice),
   * and released again if anything after that fails — the person can simply retry the same link.
   */
  async accept(token: string, input: { name: string; password: string }, now: Date = new Date()) {
    const invite = await invitesRepository.findByTokenHash(hashToken(token));
    if (!invite) throw new UserFacingError("This invite link isn't valid.");
    switch (inviteStatus(invite, now)) {
      case "expired":
        throw new UserFacingError("This invite link has expired. Request a new one.");
      case "accepted":
        throw new UserFacingError("This invite was already used. Try signing in.");
      case "revoked":
        throw new UserFacingError("This invite is no longer valid. Ask for a new one.");
    }

    if (!(await invitesRepository.claim(invite.id, now))) throw new UserFacingError("This invite was already used. Try signing in.");

    try {
      // Someone who already has a login (say, an earlier account) is added to the workspace as-is: an invite never
      // overwrites an existing password.
      const existing = await authAccountsService.findByEmail(invite.email);
      if (existing) {
        await tenancyService.addMember(invite.tenantId, existing.id);
        return { email: invite.email, createdAccount: false };
      }
      const { userId } = await authAccountsService.createAccount({ email: invite.email, name: input.name, password: input.password });
      try {
        await tenancyService.addMember(invite.tenantId, userId);
      } catch (error) {
        // The login exists but has no workspace: undo it so the retry starts clean rather than hitting "already exists".
        await authAccountsService.removeAccount(userId);
        throw error;
      }
      return { email: invite.email, createdAccount: true };
    } catch (error) {
      await invitesRepository.releaseClaim(invite.id).catch((releaseError) => console.error("Couldn't release the invite:", releaseError));
      throw error;
    }
  },
};
