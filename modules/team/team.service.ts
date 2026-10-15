import { UserFacingError } from "@/lib/errors";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { teamRepository } from "./team.repository";
import { toTeamOptions, type NewPerson, type PersonRow, type PersonUpdate } from "./team.types";

const normalizeEmail = (email: string | null | undefined) => (email?.trim() ? email.trim().toLowerCase() : null);

export const teamService = {
  /**
   * Makes sure every workspace member with a login has a person: an unlinked person with the same email gets the
   * login (that's how accepting an invite links someone the team already added by hand), anyone else gets a new
   * person. Cheap and idempotent, so every read of the team runs it — no hook in the invite flow needed.
   */
  async syncMembers(tenantId: string) {
    const [members, people] = await Promise.all([tenancyService.listMembers(tenantId), teamRepository.findAll(tenantId)]);
    const linked = new Set(people.map((p) => p.userId).filter(Boolean));
    for (const member of members) {
      if (linked.has(member.id)) continue;
      const email = normalizeEmail(member.email);
      const match = people.find((p) => !p.userId && !p.archivedAt && email && normalizeEmail(p.email) === email);
      if (match && (await teamRepository.linkIfUnlinked(tenantId, match.id, member.id))) continue;
      await teamRepository.insertForUser(tenantId, { name: member.name || member.email, email, userId: member.id });
    }
  },

  /** Everyone on the team (archived last), synced with the workspace's logins first. */
  async listPeople(tenantId: string): Promise<PersonRow[]> {
    await this.syncMembers(tenantId);
    const people = await teamRepository.findAll(tenantId);
    return [...people.filter((p) => !p.archivedAt), ...people.filter((p) => p.archivedAt)];
  },

  /** The active team in the shape owner pickers use — what every Traction page and the activity form receive. */
  async listOptions(tenantId: string) {
    return toTeamOptions(await this.listPeople(tenantId));
  },

  /** The person a login is, in this workspace (null for a super admin who isn't a member). */
  async personForUser(tenantId: string, userId: string): Promise<PersonRow | null> {
    const people = await this.listPeople(tenantId);
    return people.find((p) => p.userId === userId) ?? null;
  },

  async create(tenantId: string, data: NewPerson) {
    return teamRepository.insert(tenantId, { name: data.name.trim(), email: normalizeEmail(data.email), title: data.title?.trim() || null });
  },

  async update(tenantId: string, data: PersonUpdate) {
    const person = await teamRepository.findById(tenantId, data.id);
    if (!person) throw new UserFacingError("Person not found.");
    return teamRepository.update(tenantId, data.id, { name: data.name.trim(), email: normalizeEmail(data.email), title: data.title?.trim() || null });
  },

  /** Archived, never deleted: what they owned keeps their name. Pickers stop offering them. */
  async setArchived(tenantId: string, id: string, archived: boolean) {
    const person = await teamRepository.findById(tenantId, id);
    if (!person) throw new UserFacingError("Person not found.");
    await teamRepository.update(tenantId, id, { archivedAt: archived ? new Date() : null });
  },

  /** Links a person to a workspace member's login by hand — for when the emails differ. */
  async linkAccount(tenantId: string, personId: string, userId: string) {
    if (!(await tenancyService.isMember(tenantId, userId))) throw new UserFacingError("That account isn't a member of this workspace.");
    const people = await teamRepository.findAll(tenantId);
    const person = people.find((p) => p.id === personId);
    if (!person) throw new UserFacingError("Person not found.");
    const current = people.find((p) => p.userId === userId);
    if (current && current.id !== personId) {
      // The login was auto-given a person of its own by syncMembers; that placeholder is unlinked and archived.
      await teamRepository.update(tenantId, current.id, { userId: null, archivedAt: new Date() });
    }
    await teamRepository.update(tenantId, personId, { userId });
  },

  async unlinkAccount(tenantId: string, personId: string) {
    const person = await teamRepository.findById(tenantId, personId);
    if (!person) throw new UserFacingError("Person not found.");
    await teamRepository.update(tenantId, personId, { userId: null });
  },

  /**
   * Someone changed their own display name or email (on their profile): the person their login is in this workspace
   * follows, so Traction owners and assignee pickers show the new name. Nothing when the login has no person here.
   */
  async syncLoginDetails(tenantId: string, userId: string, details: { name?: string; email?: string }) {
    const person = await this.personForUser(tenantId, userId);
    if (!person) return;
    await teamRepository.update(tenantId, person.id, {
      ...(details.name ? { name: details.name.trim() } : {}),
      ...(details.email ? { email: normalizeEmail(details.email) } : {}),
    });
  },

  /** Throws unless the id is an active person of this workspace — used before assigning work to them. */
  async assertActivePerson(tenantId: string, personId: string | null | undefined) {
    if (!personId) return;
    const person = await teamRepository.findById(tenantId, personId);
    if (!person || person.archivedAt) throw new UserFacingError("That person isn't on this workspace's team.");
  },
};
