/**
 * An error whose message is safe to show the end user. `safe-action`'s
 * `handleServerError` only forwards the message of this class — every other
 * error (a Drizzle/Postgres failure, a bug) reaches the client as a generic
 * message, because e.g. a `DrizzleQueryError`'s message is the full SQL
 * statement plus its parameters.
 *
 * Plain TypeScript (no Next.js imports), so Services can throw it.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}
