import { resetPasswordWithToken } from "@/lib/auth-password";
import { UserFacingError } from "@/lib/errors";
import { authAccountsRepository } from "./auth-accounts.repository";

const RESET_TOKEN_TTL_MINUTES = 10;

export const authAccountsService = {
  /** Deletes a login this same flow just created (a later step failed). Never call it for an account that existed before. */
  async removeAccount(userId: string) {
    await authAccountsRepository.deleteUser(userId);
  },

  async nameOf(userId: string) {
    return authAccountsRepository.findNameById(userId);
  },

  async findByEmail(email: string) {
    return authAccountsRepository.findUserByEmail(email);
  },

  /**
   * Creates a login (Neon Auth user + password) for an email that has none. All-or-nothing: if setting the
   * password fails for any reason, the half-made user and its token are removed so the invite can be retried.
   */
  async createAccount(input: { email: string; name: string; password: string }) {
    if (await authAccountsRepository.findUserByEmail(input.email)) {
      throw new UserFacingError("An account with this email already exists. Try signing in.");
    }

    const userId = await authAccountsRepository.createUser(input.name, input.email);
    let token: string | null = null;
    try {
      token = await authAccountsRepository.createResetToken(userId, RESET_TOKEN_TTL_MINUTES);
      await resetPasswordWithToken(token, input.password);
      return { userId };
    } catch (error) {
      console.error("Creating the account failed, rolling back:", error);
      if (token) await authAccountsRepository.deleteResetToken(token).catch(() => undefined);
      await authAccountsRepository.deleteUser(userId).catch((cleanupError) => console.error("Account rollback failed:", cleanupError));
      throw new UserFacingError("Couldn't create your account. Choose a different password (at least 8 characters) and try again.");
    }
  },
};
