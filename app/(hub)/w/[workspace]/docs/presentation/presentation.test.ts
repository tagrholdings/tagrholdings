import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRESENTATION_HTML } from "./presentation-html";

const ROOT = join(__dirname, "..", "..", "..", "..", "..", "..");

describe("platform tour", () => {
  it("is built from content/presentation/index.html — run `npm run presentation:build` after editing it", () => {
    const source = readFileSync(join(ROOT, "content", "presentation", "index.html"), "utf8").replace(/\r\n/g, "\n");
    expect(PRESENTATION_HTML).toBe(source);
  });

  it("doesn't point at pages that were renamed or moved", () => {
    expect(PRESENTATION_HTML).not.toMatch(/leads-inbox|Leads Inbox|settings\/inbox/);
  });
});
