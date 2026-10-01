"use server";

import { revalidateWorkspace } from "@/lib/revalidate";
import { protectedAction } from "@/lib/safe-action";
import { organizationsService } from "./organizations.service";
import { createOrganizationSchema, updateOrganizationSchema } from "./organizations.types";

/** Organization pickers/lists show up on Contacts, Leads, Projects and Activities. */
function revalidateOrganizationPages(slug: string, id?: string) {
  revalidateWorkspace(slug, "/contacts");
  if (id) revalidateWorkspace(slug, `/contacts/${id}`);
  revalidateWorkspace(slug, "/projects");
  revalidateWorkspace(slug, "/leads");
  revalidateWorkspace(slug, "/activities");
}

export const createOrganizationAction = protectedAction
  .schema(createOrganizationSchema)
  .action(async ({ parsedInput, ctx }) => {
    const organization = await organizationsService.create(ctx.user.tenantId, parsedInput);
    revalidateOrganizationPages(ctx.workspace.slug);
    return { organization };
  });

export const updateOrganizationAction = protectedAction
  .schema(updateOrganizationSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const organization = await organizationsService.update(ctx.user.tenantId, id, data);
    revalidateOrganizationPages(ctx.workspace.slug);
    return { organization };
  });
