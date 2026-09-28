import { describe, expect, it } from "vitest";
import { acceptInviteSchema, inviteEmailSchema, inviteStatus, maskEmail } from "./invites.types";

const NOW = new Date("2026-09-28T12:00:00Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe("inviteStatus", () => {
  it("is pending until the expiry, expired after", () => {
    expect(inviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: hoursFromNow(1) }, NOW)).toBe("pending");
    expect(inviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: hoursFromNow(-1) }, NOW)).toBe("expired");
    expect(inviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: NOW }, NOW)).toBe("expired"); // the exact moment counts as expired
  });

  it("accepted and revoked outrank expiry — a used invite isn't 'expired' a week later", () => {
    const past = hoursFromNow(-24 * 30);
    expect(inviteStatus({ acceptedAt: past, revokedAt: null, expiresAt: past }, NOW)).toBe("accepted");
    expect(inviteStatus({ acceptedAt: null, revokedAt: past, expiresAt: past }, NOW)).toBe("revoked");
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain only", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j•••@example.com");
  });
});

describe("schemas", () => {
  it("normalizes the invited email (trim + lowercase) and rejects junk", () => {
    expect(inviteEmailSchema.parse({ email: "  Jane@Example.COM " }).email).toBe("jane@example.com");
    expect(inviteEmailSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("acceptInvite needs a name and an 8+ character password", () => {
    const token = "a".repeat(43);
    expect(acceptInviteSchema.safeParse({ token, name: "Jane", password: "long-enough-1" }).success).toBe(true);
    expect(acceptInviteSchema.safeParse({ token, name: "Jane", password: "short" }).success).toBe(false);
    expect(acceptInviteSchema.safeParse({ token, name: "  ", password: "long-enough-1" }).success).toBe(false);
    expect(acceptInviteSchema.safeParse({ token: "tiny", name: "Jane", password: "long-enough-1" }).success).toBe(false);
  });
});
