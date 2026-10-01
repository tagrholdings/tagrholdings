"use server";

import { revalidatePath } from "next/cache";
import { adminAction, platformAction } from "@/lib/safe-action";
import { revalidateWorkspace } from "@/lib/revalidate";
import { UserFacingError } from "@/lib/errors";
import { invitesService } from "@/modules/invites/invites.service";
import { tenancyService } from "./tenancy.service";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import {
  archiveWorkspaceSchema,
  buyerIdentitySchema,
  changeMemberRoleSchema,
  createWorkspaceWithAdminSchema,
  deleteWorkspaceSchema,
  inviteToWorkspaceSchema,
  removeMemberSchema,
  renameWorkspaceSchema,
  unarchiveWorkspaceSchema,
} from "./tenancy.types";

// ── /admin (the platform's super admin) ───────────────────────────────────────────────────────────────

/**
 * Creates a workspace and, when an email is given, invites its first admin. The workspace exists even if the invite
 * email fails to send — the failure comes back as `inviteWarning` so the admin can re-send from Settings → Invites.
 */
export const createWorkspaceAction = platformAction.schema(createWorkspaceWithAdminSchema).action(async ({ parsedInput, ctx }) => {
  const workspace = await tenancyService.createWorkspace({ name: parsedInput.name, slug: parsedInput.slug });

  let inviteWarning: string | null = null;
  if (parsedInput.adminEmail) {
    try {
      await invitesService.invite(workspace.id, { id: ctx.user.id, name: ctx.user.name || ctx.user.email }, parsedInput.adminEmail, "admin");
    } catch (error) {
      if (!(error instanceof UserFacingError)) throw error;
      inviteWarning = error.message;
    }
  }

  revalidatePath("/admin");
  return { workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name }, inviteWarning };
});

export const renameWorkspaceAction = platformAction.schema(renameWorkspaceSchema).action(async ({ parsedInput }) => {
  const workspace = await tenancyService.renameWorkspace(parsedInput.id, parsedInput.name);
  revalidatePath("/admin");
  revalidatePath(`/admin/${workspace.slug}`);
  return { workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug } };
});

/** "Create a user" for a workspace: invites them by email (they pick their own password), as admin or member. */
export const inviteToWorkspaceAction = platformAction.schema(inviteToWorkspaceSchema).action(async ({ parsedInput, ctx }) => {
  if (await rateLimitService.isLimited(`invite:user:${ctx.user.id}`, 20, 60 * 60 * 1000)) {
    throw new UserFacingError("Too many attempts. Please try again in a little while.");
  }
  const workspace = await tenancyService.getTenant(parsedInput.workspaceId);
  if (!workspace) throw new UserFacingError("That workspace no longer exists.");
  if (workspace.archivedAt) throw new UserFacingError("Restore this workspace before inviting people to it.");
  const result = await invitesService.invite(workspace.id, { id: ctx.user.id, name: ctx.user.name || ctx.user.email }, parsedInput.email, parsedInput.role);
  revalidatePath(`/admin/${workspace.slug}`);
  return result;
});

export const archiveWorkspaceAction = platformAction.schema(archiveWorkspaceSchema).action(async ({ parsedInput }) => {
  await tenancyService.archiveWorkspace(parsedInput.id, parsedInput);
  revalidatePath("/admin", "layout");
  return { success: true };
});

export const unarchiveWorkspaceAction = platformAction.schema(unarchiveWorkspaceSchema).action(async ({ parsedInput }) => {
  await tenancyService.unarchiveWorkspace(parsedInput.id);
  revalidatePath("/admin", "layout");
  return { success: true };
});

export const deleteWorkspaceAction = platformAction.schema(deleteWorkspaceSchema).action(async ({ parsedInput }) => {
  await tenancyService.deleteWorkspace(parsedInput.id, parsedInput);
  revalidatePath("/admin", "layout");
  return { success: true };
});

// ── Settings (a workspace admin) ──────────────────────────────────────────────────────────────────────

export const changeMemberRoleAction = adminAction.schema(changeMemberRoleSchema).action(async ({ parsedInput, ctx }) => {
  await tenancyService.changeMemberRole(ctx.user.tenantId, parsedInput.userId, parsedInput.role);
  revalidateWorkspace(ctx.workspace.slug, "/settings/members");
  return { success: true };
});

export const removeMemberAction = adminAction.schema(removeMemberSchema).action(async ({ parsedInput, ctx }) => {
  await tenancyService.removeMember(ctx.user.tenantId, parsedInput.userId);
  revalidateWorkspace(ctx.workspace.slug, "/settings/members");
  return { success: true };
});

export const updateBuyerIdentityAction = adminAction.schema(buyerIdentitySchema).action(async ({ parsedInput, ctx }) => {
  await tenancyService.updateBuyerIdentity(ctx.user.tenantId, parsedInput);
  revalidateWorkspace(ctx.workspace.slug, "/settings/application");
  return { success: true };
});
