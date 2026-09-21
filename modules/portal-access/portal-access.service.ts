import "server-only";
import { randomBytes } from "node:crypto";
import { portalAccessRepository } from "./portal-access.repository";

/** 9 random bytes -> 12 base64url chars. Short link, still ~72 bits of entropy — plenty for an opaque, unguessable id backed by a DB lookup (unlike the old HMAC token, this can't be forged offline, so it doesn't need more). */
function generateToken() {
  return randomBytes(9).toString("base64url");
}

export const portalAccessService = {
  /** Records the lead and mints the short token that both the cookie and the emailed link carry. */
  async grantAccess(email: string, name: string | undefined) {
    const token = generateToken();
    await portalAccessRepository.create(token, email, name);
    return token;
  },

  /**
   * Who `token` was granted to, or null if it maps to no request. Also bumps
   * `lastAccessedAt` so repeat visits are visible in the lead list.
   */
  async findVisitor(token: string | undefined | null) {
    if (!token) return null;
    const record = await portalAccessRepository.findByToken(token);
    if (!record) return null;
    portalAccessRepository.touchLastAccessed(token).catch((error) => {
      console.error("Failed to record portal access visit", error);
    });
    return { email: record.email, name: record.name };
  },
};
