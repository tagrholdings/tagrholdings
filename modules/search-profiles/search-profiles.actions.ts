"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/lib/safe-action";
import { searchProfilesService } from "./search-profiles.service";
import { createSearchProfileSchema, searchProfileIdSchema, updateSearchProfileSchema } from "./search-profiles.types";

export const createSearchProfileAction = protectedAction
  .schema(createSearchProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    const profile = await searchProfilesService.create(ctx.user.tenantId, parsedInput);
    revalidatePath("/leads-inbox/profiles");
    return { profile };
  });

export const updateSearchProfileAction = protectedAction
  .schema(updateSearchProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const profile = await searchProfilesService.update(ctx.user.tenantId, id, data);
    revalidatePath("/leads-inbox/profiles");
    return { profile };
  });

/** Queues an immediate run. `dispatch` says whether GitHub was asked to start it right now or it waits for the next scheduled run. */
export const runSearchProfileNowAction = protectedAction
  .schema(searchProfileIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { dispatch } = await searchProfilesService.requestRun(ctx.user.tenantId, parsedInput.id);
    revalidatePath("/leads-inbox/profiles");
    return { dispatch };
  });
