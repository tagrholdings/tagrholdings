import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth-accounts.repository", () => ({
  authAccountsRepository: {
    findUserByEmail: vi.fn(),
    createUser: vi.fn(),
    createResetToken: vi.fn(),
    deleteResetToken: vi.fn(),
    deleteUser: vi.fn(),
  },
}));
vi.mock("@/lib/auth-password", () => ({ resetPasswordWithToken: vi.fn() }));

import { authAccountsService } from "./auth-accounts.service";
import { authAccountsRepository as repo } from "./auth-accounts.repository";
import { resetPasswordWithToken } from "@/lib/auth-password";

const input = { email: "jane@example.com", name: "Jane", password: "long-enough-1" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.findUserByEmail).mockResolvedValue(null as never);
  vi.mocked(repo.deleteResetToken).mockResolvedValue(undefined);
  vi.mocked(repo.deleteUser).mockResolvedValue(undefined);
  vi.mocked(repo.createUser).mockResolvedValue("user-1");
  vi.mocked(repo.createResetToken).mockResolvedValue("reset-token");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("createAccount", () => {
  it("creates the user and lets Neon Auth set the password with a one-time token", async () => {
    expect(await authAccountsService.createAccount(input)).toEqual({ userId: "user-1" });
    expect(repo.createUser).toHaveBeenCalledWith("Jane", "jane@example.com");
    expect(resetPasswordWithToken).toHaveBeenCalledWith("reset-token", "long-enough-1");
  });

  it("refuses an email that already has a login — an invite never takes over an account", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue({ id: "old", name: "Jane" });
    await expect(authAccountsService.createAccount(input)).rejects.toThrow("already exists");
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it("rolls back the half-made user and its token when setting the password fails", async () => {
    vi.mocked(resetPasswordWithToken).mockRejectedValue(new Error("password too weak"));
    await expect(authAccountsService.createAccount(input)).rejects.toThrow("Couldn't create your account");
    expect(repo.deleteResetToken).toHaveBeenCalledWith("reset-token");
    expect(repo.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("the client-facing error never leaks the upstream message", async () => {
    vi.mocked(resetPasswordWithToken).mockRejectedValue(new Error("internal detail xyz"));
    await expect(authAccountsService.createAccount(input)).rejects.not.toThrow("internal detail xyz");
  });
});
