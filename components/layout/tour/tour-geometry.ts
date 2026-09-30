/**
 * The maths behind the guided tour, kept pure so it can be unit-tested without a browser.
 *
 * Everything here is in VIEWPORT coordinates (what `getBoundingClientRect()` returns), because the overlay is
 * `position: fixed`. That is what makes a target inside a scrolling panel work the same as one on the page itself.
 */

export type Placement = "top" | "bottom" | "left" | "right";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Breathing room between the spotlight and the highlighted element. */
export const SPOTLIGHT_PADDING = 8;
/** Between the spotlight and the tooltip. */
export const TOOLTIP_GAP = 12;
/** The tooltip never touches the edge of the screen. */
export const VIEWPORT_MARGIN = 16;

/** Tried in this order; the first one that fits wins, so a target low on the page gets its tooltip above it. */
const ORDER: Placement[] = ["bottom", "top", "right", "left"];

function clamp(value: number, min: number, max: number): number {
  // max can be below min on a viewport narrower than the tooltip — keep the top/left edge visible in that case.
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/** The hole cut out of the dimmed backdrop: the element plus padding, never spilling outside the screen. */
export function spotlightRect(target: Rect, viewport: Viewport, padding = SPOTLIGHT_PADDING): Rect {
  const top = Math.max(0, target.top - padding);
  const left = Math.max(0, target.left - padding);
  const bottom = Math.min(viewport.height, target.top + target.height + padding);
  const right = Math.min(viewport.width, target.left + target.width + padding);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function coordsFor(placement: Placement, target: Rect, tip: Size, viewport: Viewport, gap: number, margin: number) {
  const centerX = target.left + target.width / 2 - tip.width / 2;
  const centerY = target.top + target.height / 2 - tip.height / 2;
  const maxLeft = viewport.width - tip.width - margin;
  const maxTop = viewport.height - tip.height - margin;

  switch (placement) {
    case "bottom":
      return { top: target.top + target.height + gap, left: clamp(centerX, margin, maxLeft) };
    case "top":
      return { top: target.top - gap - tip.height, left: clamp(centerX, margin, maxLeft) };
    case "right":
      return { top: clamp(centerY, margin, maxTop), left: target.left + target.width + gap };
    case "left":
      return { top: clamp(centerY, margin, maxTop), left: target.left - gap - tip.width };
  }
}

function fitsOnScreen(placement: Placement, top: number, left: number, tip: Size, viewport: Viewport, margin: number): boolean {
  switch (placement) {
    case "bottom":
      return top + tip.height + margin <= viewport.height;
    case "top":
      return top >= margin;
    case "right":
      return left + tip.width + margin <= viewport.width;
    case "left":
      return left >= margin;
  }
}

/**
 * Where to put the tooltip next to the highlighted element (desktop). Tries below, above, right, left and takes the
 * first side with room; when nothing fits it falls back to below, clamped inside the screen, so the tooltip is always
 * reachable even on a short window.
 */
export function placeTooltip(
  target: Rect,
  tip: Size,
  viewport: Viewport,
  { gap = TOOLTIP_GAP, margin = VIEWPORT_MARGIN }: { gap?: number; margin?: number } = {}
): { top: number; left: number; placement: Placement } {
  for (const placement of ORDER) {
    const { top, left } = coordsFor(placement, target, tip, viewport, gap, margin);
    if (fitsOnScreen(placement, top, left, tip, viewport, margin)) return { top, left, placement };
  }
  const { top, left } = coordsFor("bottom", target, tip, viewport, gap, margin);
  return {
    top: clamp(top, margin, viewport.height - tip.height - margin),
    left: clamp(left, margin, viewport.width - tip.width - margin),
    placement: "bottom",
  };
}

/**
 * On a phone the tooltip is a card pinned to one edge rather than a floating bubble — there is no room to float one.
 * It sits at the bottom, unless the highlighted element is in the lower half, where the card would cover it.
 */
export function mobileCardSide(target: Rect | null, viewport: Viewport): "top" | "bottom" {
  if (!target) return "bottom";
  return target.top + target.height / 2 > viewport.height / 2 ? "top" : "bottom";
}

/** Two rects are the same to the nearest pixel — used to skip re-renders while the tour follows a moving target. */
export function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  );
}
