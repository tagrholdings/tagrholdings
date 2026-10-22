"use server";

import { adminAction } from "@/lib/safe-action";
import { revalidateWorkspace } from "@/lib/revalidate";
import { slackService } from "./slack.service";
import { slackSettingsSchema } from "./slack.types";

/** Connects this workspace to a Slack team (and the bot's command channel). Admins only. */
export const saveSlackSettingsAction = adminAction.schema(slackSettingsSchema).action(async ({ parsedInput, ctx }) => {
  await slackService.saveSettings(ctx.user.tenantId, parsedInput);
  revalidateWorkspace(ctx.workspace.slug, "/settings/integrations");
  return { saved: true };
});
