import "server-only";
import { headers } from "next/headers";
import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/lib/auth-server";
import { UserFacingError } from "@/lib/errors";
import { WORKSPACE_HEADER } from "@/lib/workspace-path";
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

/** Signed in, no workspace — for things that belong to the person, not to a workspace (their push subscriptions). */
export const userAction = actionClient.use(async ({ next }) => {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    throw new UserFacingError("You must be signed in to do that.");
  }
  return next({ ctx: { user: session.user } });
});

/**
 * Signed in AND acting inside a workspace. The workspace comes from the URL the action was called from: proxy.ts copies
 * `/w/<slug>/…` into the `x-workspace` header (a Server Action is POSTed to its page's URL). It is only an address —
 * access is checked here on every call, with the same rule the pages use (a member, or a super admin).
 *
 * Never guess: a missing header must NOT fall back to "the user's first workspace" — that would write into a workspace
 * the person isn't looking at. It fails with a message instead.
 *
 * `ctx.user.tenantId` is what services take; `ctx.workspace` carries the slug (for `revalidateWorkspace`), the name
 * and the person's role there.
 */
export const protectedAction = userAction.use(async ({ next, ctx }) => {
  const slug = (await headers()).get(WORKSPACE_HEADER);
  if (!slug) {
    throw new UserFacingError("Couldn't tell which workspace this is for. Reload the page and try again.");
  }
  const workspace = await tenancyService.resolveAccess(ctx.user.id, slug);
  if (!workspace) {
    throw new UserFacingError("You don't have access to this workspace.");
  }
  return next({ ctx: { user: { ...ctx.user, tenantId: workspace.tenantId }, workspace } });
});

/** A workspace admin (a super admin counts as one everywhere): members, invites, the buyer identity, spend. */
export const adminAction = protectedAction.use(async ({ next, ctx }) => {
  if (ctx.workspace.role !== "admin") {
    throw new UserFacingError("Only a workspace admin can do that.");
  }
  return next();
});

/** The platform's super admin — above any workspace (creating workspaces). Granted only by scripts/grant-super-admin.ts. */
export const platformAction = userAction.use(async ({ next, ctx }) => {
  if (!(await tenancyService.isSuperAdmin(ctx.user.id))) {
    throw new UserFacingError("Only a platform admin can do that.");
  }
  return next();
});
