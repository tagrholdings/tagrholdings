import { describe, expect, it } from "vitest";
import { formatNoteEntry } from "./notes";

describe("formatNoteEntry", () => {
  it("dates the note and names who wrote it", () => {
    expect(formatNoteEntry("  Talked to João, wants 2M ", "Matheus", "2026-10-22")).toBe("[2026-10-22 · Matheus] Talked to João, wants 2M");
  });

  it("leaves the author out when there isn't one", () => {
    expect(formatNoteEntry("Called back", null, "2026-10-22")).toBe("[2026-10-22] Called back");
    expect(formatNoteEntry("Called back", "  ", "2026-10-22")).toBe("[2026-10-22] Called back");
  });
});
