import { describe, expect, it } from "vitest";
import { firstUrlIn, hostOf, isSingleUrl, normalizeUrlForDedupe } from "./url";

describe("normalizeUrlForDedupe", () => {
  it("ignores case of the host, www, fragments, trailing slashes and tracking params", () => {
    const a = normalizeUrlForDedupe("HTTPS://www.BizSite.test/Listing/42/?utm_source=x&fbclid=1#top");
    const b = normalizeUrlForDedupe("https://bizsite.test/Listing/42");
    expect(a).toBe(b);
  });

  it("keeps real query parameters (they tell two listings apart) in a stable order", () => {
    expect(normalizeUrlForDedupe("https://s.test/l?id=2&page=1")).toBe(normalizeUrlForDedupe("https://s.test/l?page=1&id=2"));
    expect(normalizeUrlForDedupe("https://s.test/l?id=2")).not.toBe(normalizeUrlForDedupe("https://s.test/l?id=3"));
  });
});

describe("url helpers", () => {
  it("hostOf strips www and rejects non-http", () => {
    expect(hostOf("https://www.Example.com/x")).toBe("example.com");
    expect(hostOf("ftp://example.com")).toBe("");
    expect(hostOf("nonsense")).toBe("");
  });

  it("firstUrlIn finds a link inside prose without trailing punctuation", () => {
    expect(firstUrlIn("See https://a.test/x?y=1, then call.")).toBe("https://a.test/x?y=1");
    expect(firstUrlIn("no link here")).toBeNull();
  });

  it("isSingleUrl accepts only a lone link", () => {
    expect(isSingleUrl("  https://a.test/x  ")).toBe(true);
    expect(isSingleUrl("https://a.test/x and some words")).toBe(false);
    expect(isSingleUrl("javascript:alert(1)")).toBe(false);
    expect(isSingleUrl("just text")).toBe(false);
  });
});
