import "server-only";
import { auth } from "@/lib/auth-server";

/**
 * Sets a password through Neon Auth (Better Auth) itself, so hashing and account creation are its own — we never
 * hash a password ourselves. `token` is a reset token that already exists in Neon Auth's verification table
 * (see modules/auth-accounts). Throws when Neon Auth refuses it (invalid/expired token, password policy).
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const { error } = await auth.resetPassword({ newPassword, token });
  if (error) throw new Error(error.message ?? "Neon Auth refused the password reset.");
}

/** Signs the person in (sets the session cookies on the current response). Returns false instead of throwing. */
export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  try {
    const { error } = await auth.signIn.email({ email, password });
    return !error;
  } catch {
    return false;
  }
}
