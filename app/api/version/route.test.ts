import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/version", () => {
  it("reports the live build id, uncached (a cached answer would hide every new deploy)", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "abc123def456");
    const response = GET();
    expect(await response.json()).toEqual({ version: "abc123def456" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
