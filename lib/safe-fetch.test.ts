import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

import { lookup } from "node:dns/promises";
import { isPublicHttpUrl, isPublicIp, safeFetchText } from "./safe-fetch";

const resolvesTo = (...addresses: string[]) => vi.mocked(lookup).mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })) as never);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("isPublicIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"])(
    "%s is not public",
    (ip) => expect(isPublicIp(ip)).toBe(false)
  );
  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("%s is public", (ip) => expect(isPublicIp(ip)).toBe(true));
});

describe("isPublicHttpUrl", () => {
  it("refuses non-http schemes and literal private hosts without any DNS lookup", async () => {
    expect(await isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(await isPublicHttpUrl("http://127.0.0.1:3000/admin")).toBe(false);
    expect(await isPublicHttpUrl("http://[::1]/")).toBe(false);
    expect(await isPublicHttpUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("refuses a hostname that resolves to a private address, or to a mix", async () => {
    resolvesTo("10.0.0.5");
    expect(await isPublicHttpUrl("https://internal.example.test/")).toBe(false);
    resolvesTo("93.184.216.34", "127.0.0.1");
    expect(await isPublicHttpUrl("https://sneaky.example.test/")).toBe(false);
  });

  it("accepts a hostname that resolves only to public addresses; refuses one that doesn't resolve", async () => {
    resolvesTo("93.184.216.34");
    expect(await isPublicHttpUrl("https://example.test/")).toBe(true);
    vi.mocked(lookup).mockRejectedValue(new Error("ENOTFOUND"));
    expect(await isPublicHttpUrl("https://nope.test/")).toBe(false);
  });
});

describe("safeFetchText", () => {
  it("returns the body of a public page", async () => {
    resolvesTo("93.184.216.34");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>hi</html>", { status: 200, headers: { "content-type": "text/html" } })));
    const result = await safeFetchText("https://example.test/page");
    expect(result).toMatchObject({ status: 200, finalUrl: "https://example.test/page", text: "<html>hi</html>" });
  });

  it("re-checks EVERY redirect hop: a public URL that redirects to an internal address is refused", async () => {
    vi.mocked(lookup).mockImplementation((async (host: string) => [{ address: host === "public.test" ? "93.184.216.34" : "10.0.0.1", family: 4 }]) as never);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://internal.test/secret" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await safeFetchText("https://public.test/start")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // the internal hop was never requested
  });

  it("follows a redirect between public hosts", async () => {
    resolvesTo("93.184.216.34");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/final" } }))
      .mockResolvedValueOnce(new Response("done", { status: 200, headers: { "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await safeFetchText("https://example.test/start")).toMatchObject({ finalUrl: "https://example.test/final", text: "done" });
  });

  it("gives up after too many redirects and on network errors", async () => {
    resolvesTo("93.184.216.34");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/again" } })));
    expect(await safeFetchText("https://example.test/loop", { maxRedirects: 3 })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await safeFetchText("https://example.test/x")).toBeNull();
  });

  it("caps how much of a huge response it reads", async () => {
    resolvesTo("93.184.216.34");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(5000), { status: 200, headers: { "content-type": "text/plain" } })));
    const result = await safeFetchText("https://example.test/big", { maxBytes: 1000 });
    expect(result?.text.length).toBeLessThanOrEqual(1000);
  });
});
