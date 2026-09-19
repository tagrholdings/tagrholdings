"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/lib/safe-action";
import { emailSourcesService } from "./email-sources.service";
import { createEmailSourceSchema, emailSourceIdSchema, setSubscribedSchema, updateEmailSourceSchema } from "./email-sources.types";

const PAGE = "/leads-inbox/email-sources";

export const createEmailSourceAction = protectedAction.schema(createEmailSourceSchema).action(async ({ parsedInput, ctx }) => {
  const source = await emailSourcesService.create(ctx.user.tenantId, parsedInput);
  revalidatePath(PAGE);
  return { source };
});

export const updateEmailSourceAction = protectedAction.schema(updateEmailSourceSchema).action(async ({ parsedInput, ctx }) => {
  const { id, ...data } = parsedInput;
  const source = await emailSourcesService.update(ctx.user.tenantId, id, data);
  revalidatePath(PAGE);
  return { source };
});

export const deleteEmailSourceAction = protectedAction.schema(emailSourceIdSchema).action(async ({ parsedInput, ctx }) => {
  await emailSourcesService.remove(ctx.user.tenantId, parsedInput.id);
  revalidatePath(PAGE);
  return { success: true };
});

export const setEmailSourceSubscribedAction = protectedAction.schema(setSubscribedSchema).action(async ({ parsedInput, ctx }) => {
  const source = await emailSourcesService.setSubscribed(ctx.user.tenantId, parsedInput.id, parsedInput.subscribed);
  revalidatePath(PAGE);
  return { source };
});

/** Queues the automatic signup. `dispatch` tells the UI whether the run was started right away or will wait for the next scheduled one. */
export const attemptEmailSignupAction = protectedAction.schema(emailSourceIdSchema).action(async ({ parsedInput, ctx }) => {
  const { dispatch } = await emailSourcesService.requestAttempt(ctx.user.tenantId, parsedInput.id);
  revalidatePath(PAGE);
  return { dispatch };
});
