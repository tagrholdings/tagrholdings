import { randomBytes } from "node:crypto";
import { UserFacingError } from "@/lib/errors";
import { tenancyRepository } from "./tenancy.repository";
import { ARCHIVE_PHRASE, DELETE_PHRASE, isValidSlug, type CreateWorkspaceInput, type WorkspaceConfirmation, type WorkspaceRole } from "./tenancy.types";

/** What a signed-in person may do in one workspace. `role` is "admin" for a super admin who isn't a member. */
export interface WorkspaceAccess {
  tenantId: string;
  slug: string;
  name: string;
  /** The workspace's own leads-inbox address, before the "@domain" (see lib/inbound-address.ts). */
  inboundLocalPart: string;
  role: WorkspaceRole;
  isSuperAdmin: boolean;
}

/** The workspace's own leads-inbox address (local part): readable slug + a random token so it can't be guessed. */
function newInboundLocalPart(slug: string) {
  return `${slug}-${randomBytes(5).toString("hex")}`;
}

/** The Vercel-style double confirmation: the workspace's exact name AND the action phrase must both match. */
function assertConfirmed(workspaceName: string, phrase: string, given: WorkspaceConfirmation) {
  if (given.confirmName !== workspaceName || given.confirmPhrase !== phrase) {
    throw new UserFacingError("The confirmation text doesn't match. Type the workspace name and the phrase exactly as shown.");
  }
}

export const tenancyService = {
  /**
   * The one place access to a workspace is decided — pages (`getWorkspace`) and actions (`protectedAction`) both go
   * through it. A super admin (a platform role, see tenancy.schema.ts) can open ANY workspace and acts as its admin;
   * everyone else needs a membership; anyone else gets null (callers answer 404, never "exists but forbidden").
   */
  async resolveAccess(userId: string, slug: string): Promise<WorkspaceAccess | null> {
    if (!isValidSlug(slug)) return null;
    const tenant = await tenancyRepository.findTenantBySlug(slug);
    if (!tenant) return null;

    const [member, platformRole] = await Promise.all([
      tenancyRepository.findMember(tenant.id, userId),
      tenancyRepository.findPlatformRole(userId),
    ]);
    const isSuperAdmin = platformRole === "super_admin";
    if (!member && !isSuperAdmin) return null;
    // An archived workspace is closed to its members; only a super admin can still open it (to restore it).
    if (tenant.archivedAt && !isSuperAdmin) return null;
    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      inboundLocalPart: tenant.inboundLocalPart,
      role: isSuperAdmin ? "admin" : (member?.role as WorkspaceRole),
      isSuperAdmin,
    };
  },

  async isSuperAdmin(userId: string) {
    return (await tenancyRepository.findPlatformRole(userId)) === "super_admin";
  },

  /** The workspaces to offer in the switcher: a super admin sees all of them, everyone else only their own. */
  async listWorkspacesFor(userId: string) {
    if (await this.isSuperAdmin(userId)) {
      const memberships = new Map((await tenancyRepository.findWorkspacesForUser(userId)).map((w) => [w.id, w.role]));
      return (await tenancyRepository.findAllTenants()).map((t) => ({ ...t, role: (memberships.get(t.id) ?? "admin") as WorkspaceRole }));
    }
    return (await tenancyRepository.findWorkspacesForUser(userId)).map((w) => ({ ...w, role: w.role as WorkspaceRole }));
  },

  /** Cross-checks a tenant id that came from OUTSIDE a session (an API caller, an env var) against a real tenant. */
  async tenantExists(tenantId: string) {
    return !!(await tenancyRepository.findTenantById(tenantId));
  },

  /** An inbound email's recipient local part → its workspace (null when no workspace owns that address). */
  async findByInboundLocalPart(localPart: string) {
    return tenancyRepository.findTenantByInboundLocalPart(localPart.toLowerCase());
  },

  async getTenant(tenantId: string) {
    return tenancyRepository.findTenantById(tenantId);
  },

  /** Creates a workspace (super admin only — enforced by the caller's `platformAction`). */
  async createWorkspace(input: CreateWorkspaceInput) {
    const created = await tenancyRepository.insertTenant({
      name: input.name,
      slug: input.slug,
      inboundLocalPart: newInboundLocalPart(input.slug),
    });
    if (!created) throw new UserFacingError("That workspace address is already taken.");
    return created;
  },

  /** Gives an existing Neon Auth user access to a workspace with a role. Throws if they are already a member. */
  async addMember(tenantId: string, userId: string, role: WorkspaceRole) {
    if (!(await tenancyRepository.insertMember(tenantId, userId, role))) {
      throw new UserFacingError("This person already has access to this workspace.");
    }
  },

  async changeMemberRole(tenantId: string, userId: string, role: WorkspaceRole) {
    const member = await tenancyRepository.findMember(tenantId, userId);
    if (!member) throw new UserFacingError("That person isn't a member of this workspace.");
    if (member.role === "admin" && role !== "admin" && (await tenancyRepository.countAdmins(tenantId)) <= 1) {
      throw new UserFacingError("A workspace needs at least one admin.");
    }
    await tenancyRepository.updateMemberRole(tenantId, userId, role);
  },

  async removeMember(tenantId: string, userId: string) {
    const member = await tenancyRepository.findMember(tenantId, userId);
    if (!member) throw new UserFacingError("That person isn't a member of this workspace.");
    if (member.role === "admin" && (await tenancyRepository.countAdmins(tenantId)) <= 1) {
      throw new UserFacingError("A workspace needs at least one admin.");
    }
    await tenancyRepository.deleteMember(tenantId, userId);
  },

  async updateBuyerIdentity(tenantId: string, values: { buyerName?: string | null; buyerPhone?: string | null; buyerCompany?: string | null }) {
    await tenancyRepository.updateBuyerIdentity(tenantId, {
      buyerName: values.buyerName?.trim() || null,
      buyerPhone: values.buyerPhone?.trim() || null,
      buyerCompany: values.buyerCompany?.trim() || null,
    });
  },

  /** Every workspace, archived or not, with member counts — the super admin's list. */
  async listForAdmin() {
    return tenancyRepository.findAllForAdmin();
  },

  async getBySlug(slug: string) {
    return tenancyRepository.findTenantBySlug(slug);
  },

  async renameWorkspace(id: string, name: string) {
    const updated = await tenancyRepository.updateTenantName(id, name.trim());
    if (!updated) throw new UserFacingError("That workspace no longer exists.");
    return updated;
  },

  /** Closes the workspace to its members and to every job; nothing is deleted. Needs the name + "archive workspace" typed. */
  async archiveWorkspace(id: string, confirmation: WorkspaceConfirmation) {
    const tenant = await tenancyRepository.findTenantById(id);
    if (!tenant) throw new UserFacingError("That workspace no longer exists.");
    assertConfirmed(tenant.name, ARCHIVE_PHRASE, confirmation);
    await tenancyRepository.setTenantArchived(id, new Date());
  },

  async unarchiveWorkspace(id: string) {
    if (!(await tenancyRepository.setTenantArchived(id, null))) throw new UserFacingError("That workspace no longer exists.");
  },

  /** Deletes the workspace and all of its data for good. Needs the name + "delete workspace" typed. */
  async deleteWorkspace(id: string, confirmation: WorkspaceConfirmation) {
    const tenant = await tenancyRepository.findTenantById(id);
    if (!tenant) throw new UserFacingError("That workspace no longer exists.");
    assertConfirmed(tenant.name, DELETE_PHRASE, confirmation);
    await tenancyRepository.deleteTenantAndData(id);
  },

  /** Every ACTIVE workspace — for background jobs that sweep all of them. */
  async listTenants() {
    return tenancyRepository.findAllTenants();
  },

  async isMember(tenantId: string, userId: string) {
    return !!(await tenancyRepository.findMember(tenantId, userId));
  },

  async listMembers(tenantId: string) {
    return tenancyRepository.findMembersWithUserInfo(tenantId);
  },
};
