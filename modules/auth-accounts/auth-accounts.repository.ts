import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Unscoped `db`, raw SQL: these are Neon Auth's own tables (`neon_auth.*`) — a managed schema this app doesn't
// define in drizzle and that has no tenant_id (same reasoning as tenancy.repository's findMembersWithUserInfo).
// Neon Auth (Better Auth) stays the owner of passwords: we only create the user row and a one-time reset token,
// and let Better Auth's own reset-password endpoint hash and store the password.
export const authAccountsRepository = {
  async findUserByEmail(email: string) {
    const result = await db.execute<{ id: string; name: string }>(
      sql`select id::text as id, name from neon_auth."user" where lower(email) = ${email.toLowerCase()} limit 1`
    );
    return result.rows[0] ?? null;
  },

  async findNameById(userId: string) {
    const result = await db.execute<{ name: string }>(sql`select name from neon_auth."user" where id::text = ${userId} limit 1`);
    return result.rows[0]?.name ?? null;
  },

  async createUser(name: string, email: string) {
    // The invite email already proved the address, hence emailVerified = true.
    const result = await db.execute<{ id: string }>(
      sql`insert into neon_auth."user" (name, email, "emailVerified", role)
          values (${name}, ${email.toLowerCase()}, true, 'user')
          returning id::text as id`
    );
    return result.rows[0].id;
  },

  /** A single-use token Better Auth's /reset-password accepts (identifier `reset-password:<token>`, value = user id). */
  async createResetToken(userId: string, ttlMinutes: number) {
    const token = randomBytes(24).toString("base64url");
    await db.execute(
      sql`insert into neon_auth.verification (identifier, value, "expiresAt")
          values (${`reset-password:${token}`}, ${userId}, now() + make_interval(mins => ${ttlMinutes}))`
    );
    return token;
  },

  async deleteResetToken(token: string) {
    await db.execute(sql`delete from neon_auth.verification where identifier = ${`reset-password:${token}`}`);
  },

  /** Rolls back a half-created account (only ever called for a user this same request just created). */
  async deleteUser(userId: string) {
    await db.execute(sql`delete from neon_auth.session where "userId" = ${userId}::uuid`);
    await db.execute(sql`delete from neon_auth.account where "userId" = ${userId}::uuid`);
    await db.execute(sql`delete from neon_auth."user" where id = ${userId}::uuid`);
  },
};
