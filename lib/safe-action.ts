import "server-only";
import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/lib/auth-server";
import { UserFacingError } from "@/lib/errors";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    console.error("[action error]", e);
    // Only a UserFacingError's message reaches the client. Anything else —
    // notably a DrizzleQueryError, whose message is the full SQL statement
    // plus its params — is replaced by a generic message.
    if (e instanceof UserFacingError) return e.message;
    return GENERIC_ERROR_MESSAGE;
  },
});

export const protectedAction = actionClient.use(async ({ next }) => {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    throw new UserFacingError("You must be signed in to do that.");
  }
  const tenantId = await tenancyService.getTenantIdForUser(session.user.id);
  return next({ ctx: { user: { ...session.user, tenantId } } });
});
