"use server";

import { revalidateWorkspace } from "@/lib/revalidate";
import { protectedAction } from "@/lib/safe-action";
import { activitiesService } from "./activities.service";
import { createActivitySchema, setActivityDoneSchema, updateActivityDateSchema, updateActivitySchema } from "./activities.types";

/** Activities show up on /activities, inside pipeline items (Projects, Leads) and on a contact's panel. */
function revalidateActivityPages(slug: string) {
  revalidateWorkspace(slug, "/activities");
  revalidateWorkspace(slug, "/projects");
  revalidateWorkspace(slug, "/leads");
  revalidateWorkspace(slug, "/contacts");
}

export const createActivityAction = protectedAction
  .schema(createActivitySchema)
  .action(async ({ parsedInput, ctx }) => {
    const activity = await activitiesService.create(ctx.user.tenantId, parsedInput, ctx.user.id);
    revalidateActivityPages(ctx.workspace.slug);
    return { activity };
  });

export const updateActivityAction = protectedAction
  .schema(updateActivitySchema)
  .action(async ({ parsedInput, ctx }) => {
    const activity = await activitiesService.update(ctx.user.tenantId, parsedInput);
    revalidateActivityPages(ctx.workspace.slug);
    return { activity };
  });

export const setActivityDoneAction = protectedAction
  .schema(setActivityDoneSchema)
  .action(async ({ parsedInput, ctx }) => {
    const activity = await activitiesService.setDone(ctx.user.tenantId, parsedInput.id, parsedInput.done);
    revalidateActivityPages(ctx.workspace.slug);
    return { activity };
  });

export const updateActivityDateAction = protectedAction
  .schema(updateActivityDateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const activity = await activitiesService.updateDate(ctx.user.tenantId, parsedInput.id, parsedInput.field, parsedInput.date);
    revalidateActivityPages(ctx.workspace.slug);
    return { activity };
  });
