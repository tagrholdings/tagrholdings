"use server";

import { revalidateWorkspace } from "@/lib/revalidate";
import { protectedAction } from "@/lib/safe-action";
import { listingSitesService } from "./listing-sites.service";
import { createListingSiteSchema, setListingSiteActiveSchema } from "./listing-sites.types";

const PAGE = "/leads-inbox/listing-sites";

export const createListingSiteAction = protectedAction.schema(createListingSiteSchema).action(async ({ parsedInput, ctx }) => {
  const site = await listingSitesService.create(ctx.user.tenantId, parsedInput);
  revalidateWorkspace(ctx.workspace.slug, PAGE);
  return { site };
});

/** "Ignore" / "Use again": an ignored site is neither crawled nor re-discovered. */
export const setListingSiteActiveAction = protectedAction.schema(setListingSiteActiveSchema).action(async ({ parsedInput, ctx }) => {
  const site = await listingSitesService.setActive(ctx.user.tenantId, parsedInput.id, parsedInput.active);
  revalidateWorkspace(ctx.workspace.slug, PAGE);
  return { site };
});
