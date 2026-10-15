import { describe, expect, it } from "vitest";
import { readableEmailParts, shortHost, splitLinks } from "./linkify";

describe("splitLinks", () => {
  it("cuts the URLs out of the text, in order", () => {
    expect(splitLinks("See HVAC Co (https://b.test/1) and https://b.test/2 now")).toEqual([
      { kind: "text", value: "See HVAC Co (" },
      { kind: "link", href: "https://b.test/1" },
      { kind: "text", value: ") and " },
      { kind: "link", href: "https://b.test/2" },
      { kind: "text", value: " now" },
    ]);
  });

  it("leaves sentence punctuation out of the link", () => {
    expect(splitLinks("Go to https://b.test/x.")).toEqual([
      { kind: "text", value: "Go to " },
      { kind: "link", href: "https://b.test/x" },
      { kind: "text", value: "." },
    ]);
  });

  it("returns plain text untouched", () => {
    expect(splitLinks("no links here")).toEqual([{ kind: "text", value: "no links here" }]);
    expect(splitLinks("")).toEqual([]);
  });
});

describe("readableEmailParts", () => {
  it("drops the parentheses around a label's link and collapses runs of blank lines", () => {
    expect(readableEmailParts("Helen Guo (https://x.mail.deals.xyz/abc)\n\n\n\nSee you")).toEqual([
      { kind: "text", value: "Helen Guo " },
      { kind: "link", href: "https://x.mail.deals.xyz/abc" },
      { kind: "text", value: "\n\nSee you" },
    ]);
  });

  it("leaves a bare link and ordinary parentheses alone", () => {
    expect(readableEmailParts("Go to https://a.test (today)")).toEqual([
      { kind: "text", value: "Go to " },
      { kind: "link", href: "https://a.test" },
      { kind: "text", value: " (today)" },
    ]);
  });
});

describe("shortHost", () => {
  it("keeps the part of the host a person recognises", () => {
    expect(shortHost("https://elinkdfb.mail.smbdealhunter.xyz/ss/c/u001")).toBe("smbdealhunter.xyz");
    expect(shortHost("https://www.bizbuysell.com/x")).toBe("bizbuysell.com");
    expect(shortHost("not a url")).toBe("not a url");
  });
});
