import { z } from "zod";
import { insertOrganizationSchema } from "./organizations.schema";

export const createOrganizationSchema = insertOrganizationSchema.pick({ name: true, website: true, notes: true }).extend({
  name: z.string().trim().min(1, "Name is required."),
  website: z.union([z.url("Enter a valid URL."), z.literal("")]).optional(),
});

export type NewOrganization = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = createOrganizationSchema.partial().extend({
  id: z.uuid(),
});

/** Client-side shape — mirrors organizationsRepository's select/create/update/findByName. */
export interface OrganizationSummary {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
}
