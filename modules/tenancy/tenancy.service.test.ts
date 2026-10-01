import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./tenancy.repository", () => ({
  tenancyRepository: {
    findTenantBySlug: vi.fn(),
    findMember: vi.fn(),
    findPlatformRole: vi.fn(),
    findWorkspacesForUser: vi.fn(),
    findAllTenants: vi.fn(),
    insertTenant: vi.fn(),
    insertMember: vi.fn(),
    countAdmins: vi.fn(),
    updateMemberRole: vi.fn(),
    deleteMember: vi.fn(),
  },
}));

import { tenancyService } from "./tenancy.service";
import { tenancyRepository } from "./tenancy.repository";

const repo = vi.mocked(tenancyRepository);
const TENANT = { id: "t1", slug: "acme", name: "Acme", inboundLocalPart: "acme-0a1b2c3d4e" };

beforeEach(() => {
  vi.resetAllMocks();
  repo.findTenantBySlug.mockResolvedValue(TENANT as never);
  repo.findMember.mockResolvedValue(undefined);
  repo.findPlatformRole.mockResolvedValue(null);
});

describe("resolveAccess — the one place workspace access is decided", () => {
  it("a member gets the role they have in that workspace", async () => {
    repo.findMember.mockResolvedValue({ role: "member" } as never);
    expect(await tenancyService.resolveAccess("u1", "acme")).toEqual({
      tenantId: "t1",
      slug: "acme",
      name: "Acme",
      inboundLocalPart: "acme-0a1b2c3d4e",
      role: "member",
      isSuperAdmin: false,
    });
  });

  it("the role is per workspace: an admin there is an admin there", async () => {
    repo.findMember.mockResolvedValue({ role: "admin" } as never);
    expect((await tenancyService.resolveAccess("u1", "acme"))?.role).toBe("admin");
  });

  it("someone who isn't a member gets nothing (callers answer 404)", async () => {
    expect(await tenancyService.resolveAccess("stranger", "acme")).toBeNull();
  });

  it("an unknown workspace gets nothing", async () => {
    repo.findTenantBySlug.mockResolvedValue(undefined);
    expect(await tenancyService.resolveAccess("u1", "nope")).toBeNull();
  });

  it("a malformed or reserved slug never even reaches the database", async () => {
    for (const slug of ["", "Admin", "../etc", "a", "admin", "w", "has space", "double--hyphen"]) {
      expect(await tenancyService.resolveAccess("u1", slug)).toBeNull();
    }
    expect(repo.findTenantBySlug).not.toHaveBeenCalled();
  });

  it("a super admin can open ANY workspace, without being a member, and acts as its admin", async () => {
    repo.findPlatformRole.mockResolvedValue("super_admin");
    expect(await tenancyService.resolveAccess("root", "acme")).toMatchObject({ tenantId: "t1", role: "admin", isSuperAdmin: true });
  });

  it("a super admin who is also a plain member still acts as admin (the platform role wins)", async () => {
    repo.findPlatformRole.mockResolvedValue("super_admin");
    repo.findMember.mockResolvedValue({ role: "member" } as never);
    expect((await tenancyService.resolveAccess("root", "acme"))?.role).toBe("admin");
  });
});

describe("listWorkspacesFor", () => {
  it("a person sees only the workspaces they belong to", async () => {
    repo.findWorkspacesForUser.mockResolvedValue([{ id: "t1", slug: "acme", name: "Acme", role: "member" }] as never);
    expect(await tenancyService.listWorkspacesFor("u1")).toEqual([{ id: "t1", slug: "acme", name: "Acme", role: "member" }]);
    expect(repo.findAllTenants).not.toHaveBeenCalled();
  });

  it("a super admin sees every workspace, keeping their own role where they are a member", async () => {
    repo.findPlatformRole.mockResolvedValue("super_admin");
    repo.findWorkspacesForUser.mockResolvedValue([{ id: "t2", slug: "menlo", name: "Menlo", role: "member" }] as never);
    repo.findAllTenants.mockResolvedValue([
      { id: "t1", slug: "acme", name: "Acme" },
      { id: "t2", slug: "menlo", name: "Menlo" },
    ] as never);
    expect(await tenancyService.listWorkspacesFor("root")).toEqual([
      { id: "t1", slug: "acme", name: "Acme", role: "admin" },
      { id: "t2", slug: "menlo", name: "Menlo", role: "member" },
    ]);
  });
});

describe("createWorkspace", () => {
  it("gives the workspace its own unguessable inbox address, built from its slug", async () => {
    repo.insertTenant.mockImplementation(async (values) => ({ id: "new", ...values }) as never);
    const created = await tenancyService.createWorkspace({ name: "Menlo CRE", slug: "menlo-cre" });
    const values = repo.insertTenant.mock.calls[0][0];
    expect(values.inboundLocalPart).toMatch(/^menlo-cre-[0-9a-f]{10}$/);
    expect(created.id).toBe("new");
  });

  it("two workspaces never share an address", async () => {
    repo.insertTenant.mockImplementation(async (values) => values as never);
    await tenancyService.createWorkspace({ name: "A", slug: "aaa" });
    await tenancyService.createWorkspace({ name: "A", slug: "aaa" });
    const [first, second] = repo.insertTenant.mock.calls.map(([v]) => v.inboundLocalPart);
    expect(first).not.toBe(second);
  });

  it("says so when the address is taken", async () => {
    repo.insertTenant.mockResolvedValue(null as never);
    await expect(tenancyService.createWorkspace({ name: "Acme", slug: "acme" })).rejects.toThrow("already taken");
  });
});

describe("members", () => {
  it("the same person can join several workspaces; joining twice is refused", async () => {
    repo.insertMember.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(tenancyService.addMember("t1", "u1", "member")).resolves.toBeUndefined();
    await expect(tenancyService.addMember("t1", "u1", "member")).rejects.toThrow("already has access");
  });

  it("a workspace always keeps at least one admin — can't demote or remove the last one", async () => {
    repo.findMember.mockResolvedValue({ role: "admin" } as never);
    repo.countAdmins.mockResolvedValue(1);
    await expect(tenancyService.changeMemberRole("t1", "u1", "member")).rejects.toThrow("at least one admin");
    await expect(tenancyService.removeMember("t1", "u1")).rejects.toThrow("at least one admin");
    expect(repo.updateMemberRole).not.toHaveBeenCalled();
    expect(repo.deleteMember).not.toHaveBeenCalled();
  });

  it("with another admin around, demoting or removing an admin is fine", async () => {
    repo.findMember.mockResolvedValue({ role: "admin" } as never);
    repo.countAdmins.mockResolvedValue(2);
    await tenancyService.changeMemberRole("t1", "u1", "member");
    await tenancyService.removeMember("t1", "u1");
    expect(repo.updateMemberRole).toHaveBeenCalledWith("t1", "u1", "member");
    expect(repo.deleteMember).toHaveBeenCalledWith("t1", "u1");
  });

  it("promoting a member never trips the last-admin guard", async () => {
    repo.findMember.mockResolvedValue({ role: "member" } as never);
    await tenancyService.changeMemberRole("t1", "u2", "admin");
    expect(repo.updateMemberRole).toHaveBeenCalledWith("t1", "u2", "admin");
    expect(repo.countAdmins).not.toHaveBeenCalled();
  });

  it("someone who isn't in the workspace can't be changed or removed", async () => {
    repo.findMember.mockResolvedValue(undefined);
    await expect(tenancyService.changeMemberRole("t1", "ghost", "admin")).rejects.toThrow("isn't a member");
    await expect(tenancyService.removeMember("t1", "ghost")).rejects.toThrow("isn't a member");
  });
});
