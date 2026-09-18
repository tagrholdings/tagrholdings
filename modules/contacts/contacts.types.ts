import { z } from "zod";
import { insertContactSchema } from "./contacts.schema";

export const createContactSchema = insertContactSchema.pick({
  name: true,
  email: true,
  phone: true,
  organizationId: true,
});

export type NewContact = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial().extend({
  id: z.uuid(),
});
