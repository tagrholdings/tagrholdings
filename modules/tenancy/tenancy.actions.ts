"use server";

import { revalidatePath } from "next/cache";
import { adminAction, platformAction } from "@/lib/safe-action";
import { revalidateWorkspace } from "@/lib/revalidate";
import { UserFacingError } from "@/lib/errors";
import { invitesService } from "@/modules/invites/invites.service";
import { tenancyService } from "./tenancy.service";
import { buyerIdentitySchema, changeMemberRoleSchema, createWorkspaceWithAdminSchema, removeMemberSchema } from "./tenancy.types";

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
