"use client";

import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 768px)";

/**
 * How many table rows fit in the space an element was given, so a list can be paged to exactly fill a
 * one-screen page (HubPage `fitViewport`) instead of scrolling. Pass `ref` to the flex-1 / min-h-0 box that
 * holds the table AND its pagination; `reserved` is the height of everything in that box that isn't rows
 * (table header + pagination + gaps) and `rowHeight` the fixed height of one row.
 *
 * `ref` is a callback ref (state), not a ref object: that box is often rendered conditionally (not while a list
 * is empty), and measuring must start whenever it does appear.
 *
 * Only below `md` (phones) is the page allowed to scroll, so there it returns `mobileSize`.
 */
export function useFitPageSize({
  rowHeight,
  reserved,
  mobileSize = 10,
  min = 3,
}: {
  rowHeight: number;
  reserved: number;
  mobileSize?: number;
  min?: number;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(mobileSize);

  useEffect(() => {
    if (!element) return;
    // A ResizeObserver reports once when it starts observing and again on every resize (a window resize or a
    // rotation that crosses the breakpoint included), so no separate initial measurement is needed.
    const observer = new ResizeObserver(() => {
      if (!window.matchMedia(DESKTOP_QUERY).matches) return setPageSize(mobileSize);
      setPageSize(Math.max(min, Math.floor((element.clientHeight - reserved) / rowHeight)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, rowHeight, reserved, mobileSize, min]);

  return { ref: setElement, element, pageSize };
}
