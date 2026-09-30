import { describe, expect, it } from "vitest";
import { mobileCardSide, placeTooltip, sameRect, spotlightRect, type Rect } from "./tour-geometry";

const VIEWPORT = { width: 1200, height: 800 };
const TIP = { width: 320, height: 160 };
const rect = (over: Partial<Rect> = {}): Rect => ({ top: 300, left: 400, width: 200, height: 60, ...over });

describe("spotlightRect", () => {
  it("adds padding around the element", () => {
    expect(spotlightRect(rect(), VIEWPORT, 8)).toEqual({ top: 292, left: 392, width: 216, height: 76 });
  });

  it("never spills outside the screen", () => {
    const clipped = spotlightRect(rect({ top: 2, left: 2, width: 1190, height: 60 }), VIEWPORT, 8);
    expect(clipped.top).toBe(0);
    expect(clipped.left).toBe(0);
    expect(clipped.left + clipped.width).toBeLessThanOrEqual(VIEWPORT.width);
  });
});

describe("placeTooltip", () => {
  it("puts the tooltip below the element when there is room, centred on it", () => {
    const { placement, top, left } = placeTooltip(rect(), TIP, VIEWPORT);
    expect(placement).toBe("bottom");
    expect(top).toBe(372); // 300 + 60 + 12
    expect(left).toBe(340); // centred: 400 + 100 - 160
  });

  it("flips above the element when the bottom has no room", () => {
    const { placement, top } = placeTooltip(rect({ top: 700 }), TIP, VIEWPORT);
    expect(placement).toBe("top");
    expect(top).toBe(528); // 700 - 12 - 160
  });

  it("goes to the side when neither below nor above fits", () => {
    const tall = rect({ top: 20, height: 760 });
    expect(placeTooltip(tall, TIP, VIEWPORT).placement).toBe("right");
  });

  it("goes left when the element is against the right edge", () => {
    const tall = rect({ top: 20, height: 760, left: 900, width: 280 });
    expect(placeTooltip(tall, TIP, VIEWPORT).placement).toBe("left");
  });

  it("keeps the tooltip on screen for an element in a corner", () => {
    for (const target of [rect({ top: 0, left: 0 }), rect({ top: 780, left: 1180, width: 20, height: 20 })]) {
      const { top, left } = placeTooltip(target, TIP, VIEWPORT);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + TIP.width).toBeLessThanOrEqual(VIEWPORT.width);
    }
  });

  it("still returns a usable position when nothing fits at all", () => {
    const tiny = { width: 200, height: 200 };
    const { top, left } = placeTooltip(rect({ top: 0, left: 0, width: 200, height: 200 }), TIP, tiny);
    expect(Number.isFinite(top)).toBe(true);
    expect(left).toBeGreaterThanOrEqual(0);
  });
});

describe("mobileCardSide", () => {
  it("sits at the bottom, and moves to the top when the element is in the lower half", () => {
    expect(mobileCardSide(rect({ top: 100 }), VIEWPORT)).toBe("bottom");
    expect(mobileCardSide(rect({ top: 600 }), VIEWPORT)).toBe("top");
    expect(mobileCardSide(null, VIEWPORT)).toBe("bottom");
  });
});

describe("sameRect", () => {
  it("ignores sub-pixel movement but sees a real move", () => {
    expect(sameRect(rect(), rect({ top: 300.4 }))).toBe(true);
    expect(sameRect(rect(), rect({ top: 310 }))).toBe(false);
    expect(sameRect(null, null)).toBe(true);
    expect(sameRect(null, rect())).toBe(false);
  });
});
