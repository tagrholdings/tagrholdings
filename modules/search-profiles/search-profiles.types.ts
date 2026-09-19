import { z } from "zod";
import { insertSearchProfileSchema, type ProfileSources, type QualificationCriteria } from "./search-profiles.schema";

export const createSearchProfileSchema = insertSearchProfileSchema.pick({
  name: true,
  category: true,
  keywords: true,
  city: true,
  state: true,
  radiusMiles: true,
  sources: true,
  maxLeadsPerRun: true,
  frequencyHours: true,
  criteria: true,
  active: true,
});

export type NewSearchProfile = z.infer<typeof createSearchProfileSchema>;

export const searchProfileIdSchema = z.object({ id: z.uuid() });

export const updateSearchProfileSchema = createSearchProfileSchema.partial().extend({
  id: z.uuid(),
});

/** Client-side row shape — mirrors searchProfilesRepository.findAllForTenant. */
export interface SearchProfileSummary {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  city: string;
  state: string;
  radiusMiles: number;
  sources: ProfileSources;
  maxLeadsPerRun: number;
  frequencyHours: number;
  criteria: QualificationCriteria | null;
  active: boolean;
  /** Set while a "Run now" is queued and the job hasn't picked it up yet. */
  runRequestedAt: Date | null;
  lastRunAt: Date | null;
  createdAt: Date;
}
