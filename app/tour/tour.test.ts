import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOUR_PARTS } from "./_components/tour-nav";

const DIR = join(__dirname, "_components");
const sources = readdirSync(DIR)
  .filter((name) => /\.(tsx?|ts)$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(DIR, name), "utf8") }));
const all = sources.map((s) => s.text).join("\n");
const sectionIds = TOUR_PARTS.flatMap((part) => part.sections.map((s) => s.id));

describe("platform tour", () => {
  it("lists every page once, with a title", () => {
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    for (const part of TOUR_PARTS) for (const section of part.sections) expect(section.title.trim()).not.toBe("");
  });

  it("gives each listed page a body whose anchor matches (the contents menu links to it by id)", () => {
    const sections = sources.find((s) => s.name === "sections.tsx")!.text;
    for (const id of sectionIds) {
      expect(sections, `section "${id}" has no <PageSection id="${id}">`).toContain(`id="${id}"`);
    }
  });

  it("doesn’t mention pages that were renamed or moved", () => {
    expect(all).not.toMatch(/Leads Inbox|leads-inbox|settings\/inbox|Settings → Inbox/);
  });

  it("is in English", () => {
    expect(all).not.toMatch(/\b(você|não|também|apresentação|empresa|para o|uma)\b/i);
  });
});
