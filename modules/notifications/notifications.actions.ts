"use server";

import { z } from "zod";
import { protectedAction, userAction } from "@/lib/safe-action";
import { notificationsService } from "./notifications.service";
import { subscribePushSchema, unsubscribePushSchema } from "./notifications.types";

/** Turns notifications on for the browser that calls this (its Web Push subscription is stored for the signed-in user — not a workspace). */
export const subscribePushAction = userAction.schema(subscribePushSchema).action(async ({ parsedInput, ctx }) => {
  await notificationsService.subscribe(ctx.user.id, parsedInput);
  return { success: true };
});

export const unsubscribePushAction = userAction.schema(unsubscribePushSchema).action(async ({ parsedInput, ctx }) => {
  await notificationsService.unsubscribe(ctx.user.id, parsedInput.endpoint);
  return { success: true };
});

export const sendTestNotificationAction = protectedAction.schema(z.object({})).action(async ({ ctx }) => {
  return notificationsService.sendTest(ctx.user.id, ctx.workspace.slug);
});
