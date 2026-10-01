import { describe, expect, it } from "vitest";
import { prefillFromShare } from "./prefill";

describe("prefillFromShare", () => {
  it("a shared page: the link alone, so the quick-add fetches and reads it", () => {
    expect(prefillFromShare({ title: "HVAC business for sale", url: "https://bizsite.test/l/9" })).toBe("https://bizsite.test/l/9");
  });

  it("Android often puts the link in `text` with no `url`", () => {
    expect(prefillFromShare({ text: "https://bizsite.test/l/9" })).toBe("https://bizsite.test/l/9");
  });

  it("highlighted text + a link: keeps both (text wins over fetching a page that may block bots)", () => {
    expect(prefillFromShare({ text: "Owner retiring, $850K asking", url: "https://bizsite.test/l/9" })).toBe("Owner retiring, $850K asking\nhttps://bizsite.test/l/9");
  });

  it("text that already contains its link isn't duplicated; a link inside prose is found", () => {
    expect(prefillFromShare({ text: "Look at this https://bizsite.test/l/9 — great one" })).toBe("Look at this https://bizsite.test/l/9 — great one");
  });

  it("text only: passed through", () => {
    expect(prefillFromShare({ text: "  Plumbing route for sale, Mesa AZ  " })).toBe("Plumbing route for sale, Mesa AZ");
  });

  it("falls back to the title, then to nothing", () => {
    expect(prefillFromShare({ title: " Some page " })).toBe("Some page");
    expect(prefillFromShare({})).toBe("");
  });
});
