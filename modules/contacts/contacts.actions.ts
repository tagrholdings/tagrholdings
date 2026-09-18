"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/lib/safe-action";
import { contactsService } from "./contacts.service";
import { createContactSchema, updateContactSchema } from "./contacts.types";

export const createContactAction = protectedAction
  .schema(createContactSchema)
  .action(async ({ parsedInput, ctx }) => {
    const contact = await contactsService.create(ctx.user.tenantId, parsedInput);
    revalidatePath("/contacts");
    return { contact };
  });

export const updateContactAction = protectedAction
  .schema(updateContactSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const contact = await contactsService.update(ctx.user.tenantId, id, data);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    return { contact };
  });
