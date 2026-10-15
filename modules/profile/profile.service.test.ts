import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { listMembershipsFor: vi.fn() } }));
vi.mock("@/modules/team/team.service", () => ({ teamService: { personForUser: vi.fn(), syncLoginDetails: vi.fn() } }));

import { profileService } from "./profile.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { teamService } from "@/modules/team/team.service";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(tenancyService.listMembershipsFor).mockResolvedValue([
    { id: "t1", slug: "tagr", name: "TAGR Holdings", role: "admin" },
    { id: "t2", slug: "grounded", name: "Grounded", role: "member" },
  ]);
});

describe("profileService", () => {
  it("lists only the workspaces the person belongs to, with their role and their title on each team", async () => {
    vi.mocked(teamService.personForUser).mockImplementation(async (tenantId) =>
      tenantId === "t1" ? ({ id: "p1", name: "Tanner", email: null, title: "CEO", userId: "u1", archivedAt: null } as never) : null
    );
    expect(await profileService.getWorkspaces("u1")).toEqual([
      { id: "t1", slug: "tagr", name: "TAGR Holdings", role: "admin", title: "CEO" },
      { id: "t2", slug: "grounded", name: "Grounded", role: "member", title: null },
    ]);
  });

  it("a new name follows the person into every workspace, and returns those workspaces to revalidate", async () => {
    expect(await profileService.syncLoginDetails("u1", { name: "Tanner Milne" })).toEqual(["tagr", "grounded"]);
    expect(teamService.syncLoginDetails).toHaveBeenCalledWith("t1", "u1", { name: "Tanner Milne" });
    expect(teamService.syncLoginDetails).toHaveBeenCalledWith("t2", "u1", { name: "Tanner Milne" });
  });
});
