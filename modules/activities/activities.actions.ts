"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/lib/safe-action";
import { activitiesService } from "./activities.service";
import { createActivitySchema, setActivityDoneSchema, updateActivityDateSchema } from "./activities.types";

/** Activities show up on /activities, inside pipeline items (Projects, Leads Inbox) and on a contact's panel. */
function revalidateActivityPages() {
  revalidatePath("/activities");
  revalidatePath("/pipeline");
  revalidatePath("/leads-inbox");
  revalidatePath("/contacts");
}

export const createActivityAction = protectedAction
  .schema(createActivitySchema)
  .action(async ({ parsedInput, ctx }) => {
    const activity = await activitiesService.create(ctx.user.tenantId, parsedInput);
    revalidateActivityPages();
    return { activity };
  });

export const setActivityDoneAction = protectedAction
  .schema(setActivityDoneSchema)
  .action(async ({ parsedInput, ctx }) => {
    const activity = await activitiesService.setDone(ctx.user.tenantId, parsedInput.id, parsedInput.done);
    revalidateActivityPages();
    return { activity };
  });

export const updateActivityDateAction = protectedAction
  .schema(updateActivityDateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const activity = await activitiesService.updateDate(ctx.user.tenantId, parsedInput.id, parsedInput.field, parsedInput.date);
    revalidateActivityPages();
    return { activity };
  });
