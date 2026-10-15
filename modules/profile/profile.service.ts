import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { teamService } from "@/modules/team/team.service";
import type { ProfileDetails, ProfileWorkspace } from "./profile.types";

/**
 * The signed-in person's own profile. Their name and email live in Neon Auth (changed from the browser through
 * authClient); what this service adds is everything the CRM knows about them per workspace — their role there and
 * the title (cargo) on that workspace's team — and keeping those team entries in step when the name or email changes.
 */
export const profileService = {
  async getWorkspaces(userId: string): Promise<ProfileWorkspace[]> {
    const memberships = await tenancyService.listMembershipsFor(userId);
    return Promise.all(
      memberships.map(async (m) => {
        const person = await teamService.personForUser(m.id, userId);
        return { id: m.id, slug: m.slug, name: m.name, role: m.role, title: person?.title ?? null };
      })
    );
  },

  /**
   * After a name/email change in Neon Auth: the person their login is, in every workspace they belong to, follows.
   * Returns those workspaces' slugs, for the caller to revalidate.
   */
  async syncLoginDetails(userId: string, details: ProfileDetails): Promise<string[]> {
    const memberships = await tenancyService.listMembershipsFor(userId);
    for (const membership of memberships) {
      await teamService.syncLoginDetails(membership.id, userId, details);
    }
    return memberships.map((m) => m.slug);
  },
};
