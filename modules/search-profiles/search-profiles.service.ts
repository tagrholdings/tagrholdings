import { UserFacingError } from "@/lib/errors";
import { dispatchLeadEngineWorkflow, type DispatchOutcome } from "@/lib/github-dispatch";
import { searchProfilesRepository } from "./search-profiles.repository";
import { hasCriteria, type ProfileSources, type QualificationCriteria } from "./search-profiles.schema";
import type { NewSearchProfile } from "./search-profiles.types";

/** How long a "Run now" request counts as still queued. After this a second click is allowed (the first was probably lost). */
const RUN_REQUEST_LOCK_MS = 15 * 60 * 1000;

/**
 * A profile needs at least one source that can FIND businesses. Company-site
 * scraping alone can't — it only enriches what Places/Brave Search/a
 * marketplace already found.
 */
function assertHasDiscoverySource(sources: ProfileSources) {
  if (!sources.google_places && !sources.brave_search && !sources.marketplace_scrape) {
    throw new UserFacingError("Turn on at least one source that finds businesses (Google Places, Brave Search or a marketplace).");
  }
}

function cleanKeywords(keywords: string[]) {
  const seen = new Set<string>();
  return keywords
    .map((k) => k.trim())
    .filter((k) => k && !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()));
}

/** Drops blank keys and duplicate keywords; a criteria object with nothing set is stored as null (= no criteria). */
export function normalizeCriteria(criteria: QualificationCriteria | null | undefined): QualificationCriteria | null {
  if (!criteria) return null;
  const cleaned: QualificationCriteria = {};
  for (const [key, value] of Object.entries(criteria)) {
    if (key === "signalKeywords") continue;
    if (typeof value === "number" && Number.isFinite(value)) (cleaned as Record<string, number>)[key] = value;
  }
  const keywords = cleanKeywords(criteria.signalKeywords ?? []);
  if (keywords.length > 0) cleaned.signalKeywords = keywords;
  return hasCriteria(cleaned) ? cleaned : null;
}

export const searchProfilesService = {
  async listForTenant(tenantId: string) {
    return searchProfilesRepository.findAllForTenant(tenantId);
  },

  async create(tenantId: string, data: NewSearchProfile) {
    assertHasDiscoverySource(data.sources);
    return searchProfilesRepository.create(tenantId, {
      ...data,
      keywords: cleanKeywords(data.keywords),
      criteria: normalizeCriteria(data.criteria),
    });
  },

  async update(tenantId: string, id: string, data: Partial<NewSearchProfile>) {
    const current = await searchProfilesRepository.findById(tenantId, id);
    if (!current) {
      throw new UserFacingError("Search profile not found.");
    }
    if (data.sources) assertHasDiscoverySource(data.sources);
    const updated = await searchProfilesRepository.update(tenantId, id, {
      ...data,
      ...(data.keywords ? { keywords: cleanKeywords(data.keywords) } : {}),
      // `criteria` omitted = leave as is; `criteria: null`/empty = clear it.
      ...(data.criteria !== undefined ? { criteria: normalizeCriteria(data.criteria) } : {}),
    });
    if (!updated) {
      throw new UserFacingError("Search profile not found.");
    }
    return updated;
  },

  /**
   * "Run now": records the request on the profile (the job's contract — it treats a profile with
   * `runRequestedAt` set as due, and clears it when the run starts) and, if GitHub is configured, asks
   * Actions to start the workflow immediately. Without GitHub the request simply waits for the next
   * scheduled run. The run still obeys the profile's lead cap — that is the spend guard, "now" doesn't waive it.
   */
  async requestRun(tenantId: string, id: string, now = new Date()): Promise<{ dispatch: DispatchOutcome }> {
    const profile = await searchProfilesRepository.findById(tenantId, id);
    if (!profile) throw new UserFacingError("Search profile not found.");
    if (!profile.active) throw new UserFacingError("This profile is paused — resume it to run it.");
    if (profile.runRequestedAt && now.getTime() - profile.runRequestedAt.getTime() < RUN_REQUEST_LOCK_MS) {
      throw new UserFacingError("A run is already queued for this profile.");
    }

    await searchProfilesRepository.update(tenantId, id, { runRequestedAt: now });
    const dispatch = await dispatchLeadEngineWorkflow({ task: "engine", profile_id: id });
    return { dispatch };
  },
};
