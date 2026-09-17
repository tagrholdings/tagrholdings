import "server-only";
import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/lib/auth-server";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    console.error("[action error]", e);
    // Only the message reaches the client — never the raw error/stack, so a
    // Drizzle/Postgres error never leaks table or column names to the UI.
    return e.message || "Something went wrong. Please try again.";
  },
});

export const protectedAction = actionClient.use(async ({ next }) => {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    throw new Error("You must be signed in to do that.");
  }
  const tenantId = await tenancyService.getTenantIdForUser(session.user.id);
  return next({ ctx: { user: { ...session.user, tenantId } } });
});
