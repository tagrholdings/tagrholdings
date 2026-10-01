import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({ auth: { getSession: vi.fn() } }));
vi.mock("@/modules/tenancy/tenancy.service", () => ({ tenancyService: { resolveAccess: vi.fn(), isSuperAdmin: vi.fn() } }));

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { adminAction, platformAction, protectedAction, userAction } from "./safe-action";

const ACCESS = { tenantId: "t1", slug: "acme", name: "Acme", inboundLocalPart: "acme-x", role: "member", isSuperAdmin: false };
const USER = { id: "u1", email: "u@x.test", name: "U" };

function withHeader(slug: string | null) {
  vi.mocked(headers).mockResolvedValue(new Headers(slug ? { "x-workspace": slug } : {}) as never);
}

const schema = z.object({});
const probe = (client: typeof protectedAction) => client.schema(schema).action(async ({ ctx }) => ({ ctx }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(auth.getSession).mockResolvedValue({ data: { user: USER } } as never);
  vi.mocked(tenancyService.resolveAccess).mockResolvedValue(ACCESS as never);
  vi.mocked(tenancyService.isSuperAdmin).mockResolvedValue(false);
  withHeader("acme");
});

describe("protectedAction — the workspace comes from the URL (x-workspace) and is checked on every call", () => {
  it("resolves the workspace named by the header and exposes tenantId, slug and role", async () => {
    const result = await probe(protectedAction)({});
    expect(tenancyService.resolveAccess).toHaveBeenCalledWith("u1", "acme");
    expect(result?.data?.ctx).toMatchObject({ user: { id: "u1", tenantId: "t1" }, workspace: { slug: "acme", role: "member" } });
  });

  it("refuses when there is no session", async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ data: null } as never);
    expect((await probe(protectedAction)({}))?.serverError).toContain("signed in");
    expect(tenancyService.resolveAccess).not.toHaveBeenCalled();
  });

  it("NEVER guesses a workspace: a missing header is an error, not 'the first workspace'", async () => {
    withHeader(null);
    expect((await probe(protectedAction)({}))?.serverError).toContain("which workspace");
    expect(tenancyService.resolveAccess).not.toHaveBeenCalled();
  });

  it("a header naming a workspace the person can't open is refused (a forged x-workspace gets nothing)", async () => {
    withHeader("someone-elses");
    vi.mocked(tenancyService.resolveAccess).mockResolvedValue(null);
    expect((await probe(protectedAction)({}))?.serverError).toContain("don't have access");
  });
});

describe("adminAction", () => {
  it("lets an admin through", async () => {
    vi.mocked(tenancyService.resolveAccess).mockResolvedValue({ ...ACCESS, role: "admin" } as never);
    expect((await probe(adminAction)({}))?.data).toBeDefined();
  });

  it("refuses a plain member", async () => {
    expect((await probe(adminAction)({}))?.serverError).toContain("workspace admin");
  });

  it("lets a super admin through (they act as admin in every workspace)", async () => {
    vi.mocked(tenancyService.resolveAccess).mockResolvedValue({ ...ACCESS, role: "admin", isSuperAdmin: true } as never);
    expect((await probe(adminAction)({}))?.data).toBeDefined();
  });
});

describe("platformAction", () => {
  it("is for super admins only", async () => {
    expect((await probe(platformAction as never)({}))?.serverError).toContain("platform admin");
    vi.mocked(tenancyService.isSuperAdmin).mockResolvedValue(true);
    expect((await probe(platformAction as never)({}))?.data).toBeDefined();
  });

  it("needs no workspace header at all", async () => {
    withHeader(null);
    vi.mocked(tenancyService.isSuperAdmin).mockResolvedValue(true);
    expect((await probe(platformAction as never)({}))?.data).toBeDefined();
  });
});

describe("userAction", () => {
  it("only needs a session — a person's own device settings aren't tied to a workspace", async () => {
    withHeader(null);
    expect((await probe(userAction as never)({}))?.data).toBeDefined();
    expect(tenancyService.resolveAccess).not.toHaveBeenCalled();
  });
});
