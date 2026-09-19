"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/lib/safe-action";
import { organizationsService } from "./organizations.service";
import { createOrganizationSchema, updateOrganizationSchema } from "./organizations.types";

/** Organization pickers/lists show up on Contacts, Leads, Projects and Activities. */
function revalidateOrganizationPages(id?: string) {
  revalidatePath("/contacts");
  if (id) revalidatePath(`/contacts/${id}`);
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/activities");
}

export const createOrganizationAction = protectedAction
  .schema(createOrganizationSchema)
  .action(async ({ parsedInput, ctx }) => {
    const organization = await organizationsService.create(ctx.user.tenantId, parsedInput);
    revalidateOrganizationPages();
    return { organization };
  });

export const updateOrganizationAction = protectedAction
  .schema(updateOrganizationSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const organization = await organizationsService.update(ctx.user.tenantId, id, data);
    revalidateOrganizationPages();
    return { organization };
  });
