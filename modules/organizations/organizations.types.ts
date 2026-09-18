import { z } from "zod";
import { insertOrganizationSchema } from "./organizations.schema";

export const createOrganizationSchema = insertOrganizationSchema.pick({ name: true, website: true, notes: true }).extend({
  name: z.string().trim().min(1, "Name is required.").max(200),
  // http(s) only — a bare z.url() also accepts `javascript:`/`data:` URLs,
  // and this value is rendered as an <a href>.
  website: z
    .union([z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL." }).max(2048), z.literal("")])
    .optional(),
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
