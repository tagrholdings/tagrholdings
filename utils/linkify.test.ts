import { describe, expect, it } from "vitest";
import { splitLinks } from "./linkify";

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
