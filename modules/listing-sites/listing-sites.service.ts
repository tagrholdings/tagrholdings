import { UserFacingError } from "@/lib/errors";
import { hostOf, parseHttpUrl, registrableDomain } from "@/utils/url";
import { listingSitesRepository } from "./listing-sites.repository";
import type { NewListingSite } from "./listing-sites.types";

/** "Cool Brokers | Buy a Business" is not a name; the domain is. Names are cosmetic — the domain is the identity. */
function nameFor(siteUrl: string, given: string | undefined) {
  const trimmed = given?.trim();
  return (trimmed || hostOf(siteUrl) || siteUrl).slice(0, 200);
}

export const listingSitesService = {
  async listForTenant(tenantId: string) {
    return listingSitesRepository.findAllForTenant(tenantId);
  },

  /**
   * Adds a site by hand. One row per registrable domain: a site the engine already found (or that was added before) is
   * reported, not duplicated — and a site that was ignored is switched back on, since asking for it is a clear signal.
   */
  async create(tenantId: string, input: NewListingSite) {
    const url = parseHttpUrl(input.siteUrl);
    if (!url) throw new UserFacingError("Enter a valid web address.");
    const domain = registrableDomain(url.hostname);
    if (!domain || !domain.includes(".")) throw new UserFacingError("Enter a valid web address.");

    const existing = await listingSitesRepository.findByDomain(tenantId, domain);
    if (existing) {
      if (!existing.active) return (await listingSitesRepository.setActive(tenantId, existing.id, true)) ?? existing;
      throw new UserFacingError("That site is already on the list.");
    }

    const created = await listingSitesRepository.create(tenantId, {
      siteName: nameFor(input.siteUrl, input.siteName),
      domain,
      siteUrl: `${url.protocol}//${url.host}${url.pathname === "/" ? "/" : url.pathname}`,
      listingsUrl: input.listingsUrl ? input.listingsUrl : null,
      source: "manual",
    });
    // Lost a race with an identical add.
    if (!created) throw new UserFacingError("That site is already on the list.");
    return created;
  },

  async setActive(tenantId: string, id: string, active: boolean) {
    const updated = await listingSitesRepository.setActive(tenantId, id, active);
    if (!updated) throw new UserFacingError("Site not found.");
    return updated;
  },
};
