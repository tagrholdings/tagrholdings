"use server";

import { revalidateWorkspace } from "@/lib/revalidate";
import { protectedAction } from "@/lib/safe-action";
import { contactsService } from "./contacts.service";
import { createContactSchema, updateContactSchema } from "./contacts.types";

export const createContactAction = protectedAction
  .schema(createContactSchema)
  .action(async ({ parsedInput, ctx }) => {
    const contact = await contactsService.create(ctx.user.tenantId, parsedInput);
    revalidateWorkspace(ctx.workspace.slug, "/contacts");
    return { contact };
  });

export const updateContactAction = protectedAction
  .schema(updateContactSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const contact = await contactsService.update(ctx.user.tenantId, id, data);
    revalidateWorkspace(ctx.workspace.slug, "/contacts");
    revalidateWorkspace(ctx.workspace.slug, `/contacts/${id}`);
    return { contact };
  });
