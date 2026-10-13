import { z } from "zod";

/** A team person as pages receive them. `userId` is their login, when they have one. */
export interface PersonRow {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  userId: string | null;
  archivedAt: Date | string | null;
}

/** The shape every owner picker and owner badge uses (id = the PERSON's id). */
export interface TeamOption {
  id: string;
  name: string | null;
  email: string;
}

const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const personFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.union([z.literal(""), z.email("That doesn't look like an email.")]).nullish(),
  title: optionalText(120),
});
export const createPersonSchema = personFieldsSchema;
export const updatePersonSchema = personFieldsSchema.extend({ id: z.uuid() });
export type NewPerson = z.infer<typeof createPersonSchema>;
export type PersonUpdate = z.infer<typeof updatePersonSchema>;

export const personIdSchema = z.object({ id: z.uuid() });
export const linkAccountSchema = z.object({ personId: z.uuid(), userId: z.string().min(1).max(100) });

/** People → the picker shape. Email is required there, so a person without one shows their name in its place. */
export function toTeamOptions(people: PersonRow[]): TeamOption[] {
  return people.filter((p) => !p.archivedAt).map((p) => ({ id: p.id, name: p.name, email: p.email ?? "" }));
}
