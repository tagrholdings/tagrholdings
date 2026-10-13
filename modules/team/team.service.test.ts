import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./team.repository", () => ({
  teamRepository: { findAll: vi.fn(), findById: vi.fn(), insert: vi.fn(), update: vi.fn(), linkIfUnlinked: vi.fn(), insertForUser: vi.fn() },
}));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { listMembers: vi.fn(), isMember: vi.fn() } }));

import { teamService } from "./team.service";
import { teamRepository } from "./team.repository";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

const repo = vi.mocked(teamRepository);
const tenancy = vi.mocked(tenancyService);
const person = (id: string, email: string | null, userId: string | null = null) => ({ id, name: id, email, title: null, userId, archivedAt: null });
const member = (id: string, email: string, name: string | null = null) => ({ id, email, name, role: "member" as const });

beforeEach(() => {
  vi.resetAllMocks();
  repo.findAll.mockResolvedValue([]);
  tenancy.listMembers.mockResolvedValue([]);
});

describe("syncMembers — every login gets a person", () => {
  it("links a login to the person the team already added with the same email (an accepted invite)", async () => {
    repo.findAll.mockResolvedValue([person("p-rex", "Rex@Grounded.test")]);
    tenancy.listMembers.mockResolvedValue([member("u-rex", "rex@grounded.test")]);
    repo.linkIfUnlinked.mockResolvedValue(person("p-rex", "rex@grounded.test", "u-rex"));
    await teamService.syncMembers("t1");
    expect(repo.linkIfUnlinked).toHaveBeenCalledWith("t1", "p-rex", "u-rex");
    expect(repo.insertForUser).not.toHaveBeenCalled();
  });

  it("creates a person for a login with no match, and leaves already-linked logins alone", async () => {
    repo.findAll.mockResolvedValue([person("p-jay", "jay@x.test", "u-jay")]);
    tenancy.listMembers.mockResolvedValue([member("u-jay", "jay@x.test"), member("u-new", "New@x.test", "New Person")]);
    await teamService.syncMembers("t1");
    expect(repo.linkIfUnlinked).not.toHaveBeenCalled();
    expect(repo.insertForUser).toHaveBeenCalledTimes(1);
    expect(repo.insertForUser).toHaveBeenCalledWith("t1", { name: "New Person", email: "new@x.test", userId: "u-new" });
  });
});

describe("linking by hand", () => {
  it("only links logins that belong to the workspace", async () => {
    tenancy.isMember.mockResolvedValue(false);
    await expect(teamService.linkAccount("t1", "p1", "u-stranger")).rejects.toThrow("isn't a member");
  });

  it("moves a login off the placeholder person it was auto-given", async () => {
    tenancy.isMember.mockResolvedValue(true);
    repo.findAll.mockResolvedValue([person("p-real", "rex@personal.test"), person("p-auto", "rex@work.test", "u-rex")]);
    await teamService.linkAccount("t1", "p-real", "u-rex");
    expect(repo.update).toHaveBeenCalledWith("t1", "p-auto", expect.objectContaining({ userId: null }));
    expect(repo.update).toHaveBeenCalledWith("t1", "p-real", { userId: "u-rex" });
  });
});

describe("assertActivePerson", () => {
  it("accepts no one (unassigned) and active people, rejects archived or unknown ones", async () => {
    await expect(teamService.assertActivePerson("t1", null)).resolves.toBeUndefined();
    repo.findById.mockResolvedValue(person("p1", null));
    await expect(teamService.assertActivePerson("t1", "p1")).resolves.toBeUndefined();
    repo.findById.mockResolvedValue({ ...person("p1", null), archivedAt: new Date() } as never);
    await expect(teamService.assertActivePerson("t1", "p1")).rejects.toThrow("isn't on this workspace's team");
    repo.findById.mockResolvedValue(undefined);
    await expect(teamService.assertActivePerson("t1", "nope")).rejects.toThrow("isn't on this workspace's team");
  });
});
