"use server";

import { revalidateWorkspace } from "@/lib/revalidate";
import { userAction } from "@/lib/safe-action";
import { profileService } from "./profile.service";
import { profileDetailsSchema } from "./profile.types";

/**
 * Called by the profile page right after Neon Auth accepted a new name or email: the person's team entry in every
 * workspace they belong to follows. It belongs to the person, not one workspace — so `userAction`, and each of their
 * workspaces is revalidated where the name shows (profile, the Team tab).
 */
export const syncProfileAction = userAction.schema(profileDetailsSchema).action(async ({ parsedInput, ctx }) => {
  const slugs = await profileService.syncLoginDetails(ctx.user.id, parsedInput);
  for (const slug of slugs) revalidateWorkspace(slug, "/profile", "/contacts");
  return { success: true };
});
