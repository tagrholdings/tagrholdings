"use server";

import { revalidateWorkspace } from "@/lib/revalidate";
import { adminAction, protectedAction } from "@/lib/safe-action";
import { teamService } from "./team.service";
import { createPersonSchema, linkAccountSchema, personIdSchema, updatePersonSchema } from "./team.types";
import { z } from "zod";

/** The team shows up in every owner picker, so a change refreshes the pages that have one. */
function revalidateTeam(slug: string) {
  revalidateWorkspace(slug, "/contacts", "/activities", "/projects", "/leads", "/traction", "/traction/scorecard", "/traction/rocks", "/traction/issues", "/traction/l10", "/eos/people");
}

export const createPersonAction = protectedAction.schema(createPersonSchema).action(async ({ parsedInput, ctx }) => {
  const person = await teamService.create(ctx.user.tenantId, parsedInput);
  revalidateTeam(ctx.workspace.slug);
  return { person };
});

export const updatePersonAction = protectedAction.schema(updatePersonSchema).action(async ({ parsedInput, ctx }) => {
  await teamService.update(ctx.user.tenantId, parsedInput);
  revalidateTeam(ctx.workspace.slug);
  return { success: true };
});

export const setPersonArchivedAction = protectedAction
  .schema(personIdSchema.extend({ archived: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await teamService.setArchived(ctx.user.tenantId, parsedInput.id, parsedInput.archived);
    revalidateTeam(ctx.workspace.slug);
    return { success: true };
  });

/** Linking a person to a login decides who acts as them — a workspace admin's call. */
export const linkPersonAccountAction = adminAction.schema(linkAccountSchema).action(async ({ parsedInput, ctx }) => {
  await teamService.linkAccount(ctx.user.tenantId, parsedInput.personId, parsedInput.userId);
  revalidateTeam(ctx.workspace.slug);
  return { success: true };
});

export const unlinkPersonAccountAction = adminAction.schema(personIdSchema).action(async ({ parsedInput, ctx }) => {
  await teamService.unlinkAccount(ctx.user.tenantId, parsedInput.id);
  revalidateTeam(ctx.workspace.slug);
  return { success: true };
});
