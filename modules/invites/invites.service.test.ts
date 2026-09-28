import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./invites.repository", () => ({
  invitesRepository: {
    findAllForTenant: vi.fn(),
    findById: vi.fn(),
    findOpenByEmail: vi.fn(),
    create: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
    findByTokenHash: vi.fn(),
    claim: vi.fn(),
    releaseClaim: vi.fn(),
    rotateById: vi.fn(),
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ crmUrl: () => "https://crm.example" }));
vi.mock("@/modules/auth-accounts/auth-accounts.service", () => ({
  authAccountsService: { findByEmail: vi.fn(), createAccount: vi.fn(), removeAccount: vi.fn(), nameOf: vi.fn() },
}));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { isMember: vi.fn(), addMember: vi.fn() } }));

import { invitesService } from "./invites.service";
import { invitesRepository } from "./invites.repository";
import { sendEmail } from "@/lib/email/send";
import { authAccountsService } from "@/modules/auth-accounts/auth-accounts.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

const NOW = new Date("2026-09-28T12:00:00Z");
const inviter = { id: "u1", name: "Tanner" };
const base = { id: "inv1", tenantId: "t1", email: "jane@example.com", invitedByUserId: "u1", acceptedAt: null, revokedAt: null };
const pending = { ...base, expiresAt: new Date(NOW.getTime() + 86_400_000) };
const expired = { ...base, expiresAt: new Date(NOW.getTime() - 86_400_000) };
const sentLink = () => (vi.mocked(sendEmail).mock.calls.at(-1)?.[0].text.match(/token=([^\s]+)/)?.[1] ?? "") as string;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sendEmail).mockResolvedValue(true);
  vi.mocked(invitesRepository.claim).mockResolvedValue(pending as never);
  vi.mocked(invitesRepository.rotateById).mockResolvedValue(pending as never);
  vi.mocked(invitesRepository.releaseClaim).mockResolvedValue(undefined);
  vi.mocked(authAccountsService.createAccount).mockResolvedValue({ userId: "new-user" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("invite", () => {
  it("stores only a hash of the token and emails the link to the invitee", async () => {
    const result = await invitesService.invite("t1", inviter, "jane@example.com", NOW);
    expect(result).toEqual({ resent: false });
    const created = vi.mocked(invitesRepository.create).mock.calls[0][1];
    expect(created).toMatchObject({ email: "jane@example.com", invitedByUserId: "u1" });
    expect(created.expiresAt).toEqual(new Date(NOW.getTime() + 7 * 86_400_000));
    // The DB holds a hash, never the token that is in the link.
    const token = sentLink();
    expect(token.length).toBeGreaterThan(20);
    expect(created.tokenHash).not.toContain(token);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@example.com" }));
  });

  it("inviting someone who already has an open invite re-sends it instead of adding a second", async () => {
    vi.mocked(invitesRepository.findOpenByEmail).mockResolvedValue(pending as never);
    expect(await invitesService.invite("t1", inviter, "jane@example.com", NOW)).toEqual({ resent: true });
    expect(invitesRepository.create).not.toHaveBeenCalled();
    expect(invitesRepository.rotate).toHaveBeenCalledWith("t1", "inv1", expect.objectContaining({ tokenHash: expect.any(String) }));
  });

  it("refuses someone who is already on the team", async () => {
    vi.mocked(authAccountsService.findByEmail).mockResolvedValue({ id: "u9", name: "Jane" });
    vi.mocked(tenancyService.isMember).mockResolvedValue(true);
    await expect(invitesService.invite("t1", inviter, "jane@example.com", NOW)).rejects.toThrow("already has access");
    expect(invitesRepository.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("keeps the invite but says so when the email couldn't be sent", async () => {
    vi.mocked(sendEmail).mockResolvedValue(false);
    await expect(invitesService.invite("t1", inviter, "jane@example.com", NOW)).rejects.toThrow("couldn't be sent");
    expect(invitesRepository.create).toHaveBeenCalled();
  });
});

describe("linkState (the accept page)", () => {
  it("valid, expired, used, revoked, and unknown links each read differently", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValueOnce(pending as never);
    expect(await invitesService.linkState("tok", NOW)).toEqual({ state: "valid", email: "jane@example.com" });
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValueOnce(expired as never);
    expect(await invitesService.linkState("tok", NOW)).toEqual({ state: "expired", maskedEmail: "j•••@example.com" });
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValueOnce({ ...pending, acceptedAt: NOW } as never);
    expect(await invitesService.linkState("tok", NOW)).toEqual({ state: "used" });
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValueOnce({ ...pending, revokedAt: NOW } as never);
    expect(await invitesService.linkState("tok", NOW)).toEqual({ state: "revoked" });
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValueOnce(undefined as never);
    expect(await invitesService.linkState("tok", NOW)).toEqual({ state: "invalid" });
  });

  it("the expired page never exposes the full address", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValue(expired as never);
    expect(JSON.stringify(await invitesService.linkState("tok", NOW))).not.toContain("jane@");
  });
});

describe("requestNewLink (the expired-link escape hatch)", () => {
  it("rotates the token and emails the fresh link to the invite's own address", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValue(expired as never);
    await invitesService.requestNewLink("old-token", NOW);
    const rotation = vi.mocked(invitesRepository.rotateById).mock.calls[0];
    expect(rotation[0]).toBe("inv1");
    expect(rotation[1].expiresAt).toEqual(new Date(NOW.getTime() + 7 * 86_400_000));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@example.com" }));
    expect(sentLink()).not.toBe("old-token");
  });

  it("won't revive a used, revoked or unknown invite", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValueOnce({ ...expired, acceptedAt: NOW } as never);
    await expect(invitesService.requestNewLink("t", NOW)).rejects.toThrow("already used");
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValueOnce({ ...expired, revokedAt: NOW } as never);
    await expect(invitesService.requestNewLink("t", NOW)).rejects.toThrow("no longer valid");
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValueOnce(undefined as never);
    await expect(invitesService.requestNewLink("t", NOW)).rejects.toThrow("isn't valid");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("accept", () => {
  const input = { name: "Jane", password: "long-enough-1" };

  it("creates the account, adds the person to the workspace, and reports a new account", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValue(pending as never);
    expect(await invitesService.accept("tok", input, NOW)).toEqual({ email: "jane@example.com", createdAccount: true });
    expect(authAccountsService.createAccount).toHaveBeenCalledWith({ email: "jane@example.com", ...input });
    expect(tenancyService.addMember).toHaveBeenCalledWith("t1", "new-user");
    expect(invitesRepository.releaseClaim).not.toHaveBeenCalled();
  });

  it("an expired link is refused with guidance to request a new one, and nothing is created", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValue(expired as never);
    await expect(invitesService.accept("tok", input, NOW)).rejects.toThrow("expired");
    expect(invitesRepository.claim).not.toHaveBeenCalled();
    expect(authAccountsService.createAccount).not.toHaveBeenCalled();
  });

  it("a link that was used a moment ago (lost the race) is refused", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValue(pending as never);
    vi.mocked(invitesRepository.claim).mockResolvedValue(undefined as never);
    await expect(invitesService.accept("tok", input, NOW)).rejects.toThrow("already used");
    expect(authAccountsService.createAccount).not.toHaveBeenCalled();
  });

  it("if creating the account fails, the invite is released so the same link can be retried", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValue(pending as never);
    vi.mocked(authAccountsService.createAccount).mockRejectedValue(new Error("boom"));
    await expect(invitesService.accept("tok", input, NOW)).rejects.toThrow("boom");
    expect(invitesRepository.releaseClaim).toHaveBeenCalledWith("inv1");
  });

  it("if joining the workspace fails, the just-made login is removed and the invite released", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValue(pending as never);
    vi.mocked(tenancyService.addMember).mockRejectedValue(new Error("no tenant"));
    await expect(invitesService.accept("tok", input, NOW)).rejects.toThrow("no tenant");
    expect(authAccountsService.removeAccount).toHaveBeenCalledWith("new-user");
    expect(invitesRepository.releaseClaim).toHaveBeenCalledWith("inv1");
  });

  it("someone who already has a login is added without touching their password", async () => {
    vi.mocked(invitesRepository.findByTokenHash).mockResolvedValue(pending as never);
    vi.mocked(authAccountsService.findByEmail).mockResolvedValue({ id: "old-user", name: "Jane" });
    expect(await invitesService.accept("tok", input, NOW)).toEqual({ email: "jane@example.com", createdAccount: false });
    expect(authAccountsService.createAccount).not.toHaveBeenCalled();
    expect(tenancyService.addMember).toHaveBeenCalledWith("t1", "old-user");
  });
});
