import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({ auth: { getSession: vi.fn() } }));
vi.mock("@/modules/lead-engine/lead-engine.service", () => ({ leadEngineService: { getLiveRuns: vi.fn() } }));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { resolveAccess: vi.fn() } }));

import { GET } from "./route";
import { auth } from "@/lib/auth-server";
import { leadEngineService } from "@/modules/lead-engine/lead-engine.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

const request = (workspace?: string) => new Request(`https://crm.test/api/lead-engine/status${workspace ? `?workspace=${workspace}` : ""}`);
const ACCESS = { tenantId: "t1", slug: "acme", name: "Acme", inboundLocalPart: "acme-x", role: "member", isSuperAdmin: false } as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("GET /api/lead-engine/status", () => {
  it("is for signed-in members only", async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ data: null } as never);
    expect((await GET(request("acme"))).status).toBe(401);
    expect(leadEngineService.getLiveRuns).not.toHaveBeenCalled();
  });

  it("answers 404 for a workspace the caller can't open, or none at all", async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ data: { user: { id: "u1" } } } as never);
    vi.mocked(tenancyService.resolveAccess).mockResolvedValue(null);
    expect((await GET(request("not-mine"))).status).toBe(404);
    expect((await GET(request())).status).toBe(404);
    expect(leadEngineService.getLiveRuns).not.toHaveBeenCalled();
  });

  it("returns the live runs for the requested workspace, uncached", async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ data: { user: { id: "u1" } } } as never);
    vi.mocked(tenancyService.resolveAccess).mockResolvedValue(ACCESS);
    vi.mocked(leadEngineService.getLiveRuns).mockResolvedValue({ configured: true, unavailable: false, runs: [], fetchedAt: "x" });
    const response = await GET(request("acme"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(tenancyService.resolveAccess).toHaveBeenCalledWith("u1", "acme");
    expect(leadEngineService.getLiveRuns).toHaveBeenCalledWith("t1");
  });

  it("masks a failure as a generic 500", async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ data: { user: { id: "u1" } } } as never);
    vi.mocked(tenancyService.resolveAccess).mockResolvedValue(ACCESS);
    vi.mocked(leadEngineService.getLiveRuns).mockRejectedValue(new Error("token ghp_secret leaked in message"));
    const response = await GET(request("acme"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("ghp_secret");
  });
});
