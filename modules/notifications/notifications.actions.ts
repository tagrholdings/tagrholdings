"use server";

import { z } from "zod";
import { protectedAction } from "@/lib/safe-action";
import { notificationsService } from "./notifications.service";
import { subscribePushSchema, unsubscribePushSchema } from "./notifications.types";

/** Turns notifications on for the browser that calls this (its Web Push subscription is stored for the signed-in user). */
export const subscribePushAction = protectedAction.schema(subscribePushSchema).action(async ({ parsedInput, ctx }) => {
  await notificationsService.subscribe(ctx.user.tenantId, ctx.user.id, parsedInput);
  return { success: true };
});

export const unsubscribePushAction = protectedAction.schema(unsubscribePushSchema).action(async ({ parsedInput, ctx }) => {
  await notificationsService.unsubscribe(ctx.user.tenantId, ctx.user.id, parsedInput.endpoint);
  return { success: true };
});

export const sendTestNotificationAction = protectedAction.schema(z.object({})).action(async ({ ctx }) => {
  return notificationsService.sendTest(ctx.user.tenantId, ctx.user.id);
});
